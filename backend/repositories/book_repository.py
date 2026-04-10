from typing import List, Optional, Tuple
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from models import Book, BookChapter, BookVocab, BookContext, UserVocab, BookEntity
from repositories.base import BaseRepository
from datetime import datetime
import uuid
from pathlib import Path
import json

class BookRepository(BaseRepository):
    async def get_all(self) -> List[Book]:
        statement = select(Book).order_by(Book.added_date.desc())
        result = await self.session.execute(statement)
        return result.scalars().all()

    async def get_by_id_enriched(self, book_id: str) -> Optional[dict]:
        stmt = select(Book).where(Book.id == book_id).options(
            selectinload(Book.chapters),
            selectinload(Book.vocab),
            selectinload(Book.entities)
        )
        book = (await self.session.execute(stmt)).scalar_one_or_none()
        if not book: return None
        
        ctx_stmt = select(BookContext).where(BookContext.book_id == book_id)
        ctx_rows = (await self.session.execute(ctx_stmt)).scalars().all()
        contexts_map = {}
        for c in ctx_rows:
            l_key = c.lemma.lower()
            if l_key not in contexts_map: contexts_map[l_key] = []
            if len(contexts_map[l_key]) < 10:
                contexts_map[l_key].append(c.example_sentence)

        lemmas = [v.lemma for v in book.vocab]
        count_stmt = select(
            BookVocab.lemma, 
            func.sum(BookVocab.occurrence_count).label("total")
        ).where(
            BookVocab.lemma.in_(
                select(BookVocab.lemma).where(BookVocab.book_id == book_id)
            )
        ).group_by(BookVocab.lemma)
        count_res = await self.session.execute(count_stmt)
        global_counts = {r[0]: r[1] for r in count_res.all()}

        user_stmt = select(UserVocab.lemma, UserVocab.status).where(
            UserVocab.lemma.in_(
                select(BookVocab.lemma).where(BookVocab.book_id == book_id)
            )
        )
        user_res = await self.session.execute(user_stmt)
        user_status_map = {r[0]: r[1] for r in user_res.all()}

        res = book.model_dump()
        res["chapters"] = [{"number": c.chapter_number, "word_count": c.word_count} for c in book.chapters]
        
        enriched_vocab = []
        for v in book.vocab:
            d = v.model_dump()
            d["count"] = v.occurrence_count
            d["status"] = user_status_map.get(v.lemma, v.status)
            d["global_count"] = global_counts.get(v.lemma, v.occurrence_count)
            d["examples"] = contexts_map.get(v.lemma.lower(), [])
            d["example"] = d["examples"][0] if d["examples"] else ""
            try:
                d["chapters"] = json.loads(v.chapter_list) if v.chapter_list else []
            except:
                d["chapters"] = []
            enriched_vocab.append(d)
            
        res["vocab"] = enriched_vocab
        
        # Format Entities
        res["entities"] = []
        for e in book.entities:
            ed = e.model_dump()
            try:
                ed["relationships"] = json.loads(e.relationships) if e.relationships else []
            except:
                ed["relationships"] = []
            res["entities"].append(ed)
            
        return res

    async def delete(self, book_id: str) -> bool:
        statement = delete(Book).where(Book.id == book_id)
        result = await self.session.execute(statement)
        await self.session.commit()
        return result.rowcount > 0

    async def save_book(self, filename: str, result_data: dict) -> str:
        stmt = select(Book).where(Book.filename == filename)
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        book_id = existing.id if existing else str(uuid.uuid4())[:8]
        
        book = Book(
            id=book_id,
            title=Path(filename).stem.replace('_', ' ').replace('-', ' ').title(),
            filename=filename,
            added_date=datetime.now().isoformat(),
            total_words=result_data.get('total_words', 0),
            unique_lemmas=result_data.get('unique_lemmas', 0),
            difficult_count=result_data.get('difficult_count', 0),
            idiom_count=result_data.get('idiom_count', 0),
            total_chapters=result_data.get('total_chapters', 0)
        )
        await self.session.merge(book)

        await self.session.execute(delete(BookVocab).where(BookVocab.book_id == book_id))
        await self.session.execute(delete(BookChapter).where(BookChapter.book_id == book_id))
        await self.session.execute(delete(BookContext).where(BookContext.book_id == book_id))
        await self.session.execute(delete(BookEntity).where(BookEntity.book_id == book_id))

        for ch in result_data.get('chapters', []):
            self.session.add(BookChapter(book_id=book_id, chapter_number=ch.get('number', 0), word_count=ch.get('word_count', 0)))

        for v in result_data.get('vocab', []):
            lemma = v.get('lemma', '')
            self.session.add(BookVocab(
                book_id=book_id, lemma=lemma, pos=v.get('pos', ''), occurrence_count=v.get('count', 1),
                first_chapter=v.get('first_chapter', 0), chapter_list=json.dumps(v.get('chapters', [])),
                is_idiom=bool(v.get('is_idiom', False)), idiom_type=v.get('idiom_type', ''),
                simple_def=v.get('simple_def', ''), memory_tip=v.get('memory_tip', ''),
                llm_example=v.get('llm_example', ''), translation=v.get('translation', ''),
                has_llm=bool(v.get('has_llm', False)), status=v.get('status', 'learning'), cefr=v.get('cefr', '?')
            ))
            
            examples = v.get('examples', [])
            if not examples and v.get('example'): examples = [v.get('example')]
            for ex in examples[:10]:
                if ex:
                    self.session.add(BookContext(book_id=book_id, lemma=lemma.lower(), example_sentence=ex))
        
        # Save Entities
        for e in result_data.get('entities', []):
            self.session.add(BookEntity(
                book_id=book_id,
                text=e.get("text", ""),
                label=e.get("label", "Concept"),
                occurrence_count=e.get("count", 1),
                first_chapter=e.get("first_chapter", 0),
                relationships=json.dumps(e.get("relationships", []))
            ))
        
        await self.session.commit()
        return book_id

    async def get_vocab_paginated(self, book_id: str, page: int, page_size: int, search: str = "", cefr: str = "", type: str = "") -> Tuple[List[dict], int]:
        stmt = select(BookVocab).where(BookVocab.book_id == book_id)
        if search:
            stmt = stmt.where((BookVocab.lemma.ilike(f"%{search}%")) | (BookVocab.translation.ilike(f"%{search}%")))
        if cefr:
            stmt = stmt.where(BookVocab.cefr == cefr)
        if type == "idiom":
            stmt = stmt.where(BookVocab.is_idiom == True)
        elif type == "word":
            stmt = stmt.where(BookVocab.is_idiom == False)
            
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar() or 0
        
        stmt = stmt.order_by(BookVocab.occurrence_count.desc()).limit(page_size).offset((page - 1) * page_size)
        rows = (await self.session.execute(stmt)).scalars().all()
        
        items = []
        for r in rows:
            d = r.model_dump()
            d["count"] = r.occurrence_count
            try:
                d["chapters"] = json.loads(r.chapter_list) if r.chapter_list else []
            except:
                d["chapters"] = []
            
            g_stmt = select(func.sum(BookVocab.occurrence_count)).where(BookVocab.lemma == r.lemma)
            d["global_count"] = (await self.session.execute(g_stmt)).scalar() or r.occurrence_count
            
            stmt_ctx = select(BookContext.example_sentence).where(BookContext.book_id == book_id, BookContext.lemma == r.lemma.lower()).limit(10)
            d["examples"] = (await self.session.execute(stmt_ctx)).scalars().all()
            d["example"] = d["examples"][0] if d["examples"] else ""
            
            items.append(d)
            
        return items, total_count

    async def get_contexts_for_word(self, lemma: str) -> List[dict]:
        stmt = select(BookContext, Book.title).join(Book).where(BookContext.lemma == lemma.lower()).limit(200)
        result = await self.session.execute(stmt)
        results_map = {}
        for row in result.all():
            ctx, title = row
            if ctx.book_id not in results_map:
                results_map[ctx.book_id] = {"book_id": ctx.book_id, "title": title, "examples": []}
            if len(results_map[ctx.book_id]["examples"]) < 10:
                results_map[ctx.book_id]["examples"].append(ctx.example_sentence)
        return list(results_map.values())
