import asyncio
import json
import logging
import traceback
from pathlib import Path
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from jobs.store import update_job
from services.parser import split_into_chapters
from services.nlp import run_pipeline
from services.filter import filter_vocabulary
from services.llm import generate_explanations
from services.idioms import detect_idioms, detect_phrasal_verbs, detect_collocations
from services.library import save_book

logger = logging.getLogger(__name__)

async def run_book_pipeline(
    job_id: str,
    clean_text: str,
    filename: str,
    user_level: str,
    native_language: str,
    llm_provider: str,
    api_key: str,
    session: Optional[AsyncSession] = None
):
    """
    Decoupled processing orchestrator (Phase 5/6).
    Handles parsing, NLP (Lexicon + Entities), and enrichment.
    """
    try:
        update_job(job_id, status="processing", progress=5)

        # 1. Structural Analysis
        total_words = len(clean_text.split())
        chapters = split_into_chapters(clean_text)
        chapter_meta = [
            {"number": ch["number"], "word_count": ch["word_count"]}
            for ch in chapters
        ]
        update_job(job_id, progress=10)

        # 2. NLP Pipeline (Lexicon + Entities + Relationships)
        def nlp_progress(pct):
            update_job(job_id, progress=pct)

        loop = asyncio.get_event_loop()
        # Updated return signature: (lemma_data, entity_list, all_docs)
        lemma_data, entity_list, all_docs = await loop.run_in_executor(
            None, lambda: run_pipeline(clean_text, progress_callback=nlp_progress)
        )
        unique_lemmas = len(lemma_data)
        update_job(job_id, progress=55)

        # 3. Phrase Detection
        lemma_keys_set = set(lemma_data.keys())
        idiom_matches = await loop.run_in_executor(
            None, lambda: detect_idioms(clean_text, lemma_keys_set)
        )
        collocation_matches = await loop.run_in_executor(
            None, lambda: detect_collocations(clean_text)
        )
        
        phrasal_verb_matches = []
        for doc in all_docs:
            phrasal_verb_matches.extend(detect_phrasal_verbs(doc))
            
        pv_seen = set()
        pv_deduped = []
        for pv in phrasal_verb_matches:
            if pv["lemma"] not in pv_seen:
                pv_seen.add(pv["lemma"])
                pv_deduped.append(pv)
            else:
                for existing in pv_deduped:
                    if existing["lemma"] == pv["lemma"]:
                        existing["count"] += pv["count"]
                        break
        
        all_phrase_matches = idiom_matches + collocation_matches + pv_deduped
        update_job(job_id, progress=58)

        # 4. Vocabulary Filtering
        vocab = filter_vocabulary(lemma_data, user_level=user_level, top_n=3000)

        for entry in vocab:
            entry.setdefault("is_idiom", False)
            entry.setdefault("idiom_type", "")
            entry.setdefault("first_chapter", entry.get("first_chapter", 0))
            entry.setdefault("chapters", entry.get("chapters", []))
            entry["definition"] = ""
            entry["phonetics"] = ""
            entry["api_example"] = ""
            entry["simple_def"] = ""
            entry["memory_tip"] = ""
            entry["llm_example"] = ""
            entry["translation"] = ""
            entry["has_llm"] = False

        update_job(job_id, progress=60)

        # 5. Deduplication & Phrase Prioritization
        vocab_map = {v["lemma"]: v for v in vocab}
        for p in all_phrase_matches:
            vocab_map[p["lemma"]] = p
        final_vocab = list(vocab_map.values())

        # 6. LLM Enrichment
        if api_key:
            update_job(job_id, progress=78)
            try:
                llm_eligible = [e for e in final_vocab if not e.get("is_idiom")]
                def llm_progress(done, total):
                    pct = 78 + int((done / total) * 17)
                    update_job(job_id, progress=pct)

                llm_data = await generate_explanations(
                    vocab=llm_eligible,
                    native_language=native_language,
                    provider_name=llm_provider,
                    api_key=api_key,
                    max_words=200,
                    progress_callback=llm_progress,
                )

                for entry in final_vocab:
                    if entry.get("is_idiom"): continue
                    llm = llm_data.get(entry["lemma"], {})
                    if llm:
                        entry["simple_def"] = llm.get("simple_def", "")
                        entry["memory_tip"] = llm.get("memory_tip", "")
                        entry["llm_example"] = llm.get("llm_example", "")
                        entry["translation"] = llm.get("translation", "")
                        entry["has_llm"] = True
            except Exception as e:
                logger.error(f"LLM enrichment failed: {e}")

        # 7. Final Result Construction & Persistence
        clean_title = Path(filename).stem.replace('_', ' ').replace('-', ' ').title()
        
        result = {
            "title": clean_title,
            "total_words": total_words,
            "unique_lemmas": unique_lemmas,
            "difficult_count": len([v for v in final_vocab if v.get("is_difficult")]),
            "idiom_count": len([v for v in final_vocab if v.get("is_idiom")]),
            "chapters": chapter_meta,
            "total_chapters": len(chapter_meta),
            "vocab": final_vocab,
            "entities": entity_list
        }

        try:
            await save_book(filename, result, session=session)
        except Exception as save_err:
            logger.warning(f"Library save failed: {save_err}")

        update_job(job_id, status="done", progress=100, result=result)

    except Exception as e:
        logger.error(f"Pipeline error: {traceback.format_exc()}")
        update_job(job_id, status="error", error=str(e))
