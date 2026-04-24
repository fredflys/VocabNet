"""
NLP pipeline using spaCy.
- Tokenizes and lemmatizes text
- Tags part of speech
- Runs named entity recognition to extract Characters, Locations, and Concepts
- Implements Local Heuristics for high-accuracy entity classification (No LLM)
"""
import re
import spacy
from collections import defaultdict
from wordfreq import zipf_frequency

_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp

# ── Heuristic Constants ──────────────────────────────────────────────────────

_VALID_POS = {"NOUN", "VERB", "ADJ", "ADV"}
_EXCLUDED_ENT_TYPES = {"DATE", "TIME", "PERCENT", "MONEY", "QUANTITY", "ORDINAL", "CARDINAL"}

# Verbs that typically imply a human subject (Character)
_HUMAN_VERBS = {
    "say", "tell", "think", "know", "believe", "write", "argue", "propose",
    "discover", "find", "walk", "live", "speak", "claim", "suggest", "feel",
    "study", "work", "born", "die", "observe", "conclude", "calculate", "publish",
    "measure", "experiment"
}

# Entities that are often mis-tagged as ORG or PERSON but are actually Locations or Concepts
_NATURAL_ENTITIES = {
    "sun", "moon", "earth", "universe", "galaxy", "nature", "space", "time",
    "heaven", "hell", "world", "cosmos", "atmosphere", "evolution", "physics"
}

# Regex for scientific units (e.g., MeV, GeV, Hz, km/s)
_UNIT_PATTERN = re.compile(r"^(?:[0-9]*\s*)?[MGkmunp]?([eE]V|Hz|J|W|V|A|K|m/s|kg|mol|cd)[.]?$|^[A-Z]{2,4}[.]?$")

# Regex for structural markers we want to ignore (e.g. Chapter 1, Section A)
_STRUCTURAL_IGNORE_RE = re.compile(r"^(chapter|section|part|volume|book|page|fig|figure|table)\s*(\d+|[ivx]+|[a-z])?$", re.I)

_CHAPTER_MARKER_RE = re.compile(r"<CHAPTER (\d+)>")

# ── Helper Functions ─────────────────────────────────────────────────────────

def _extract_vocab_and_entities(
    doc, sent, chapter_num, entity_map, lemma_data,
    lowercase_counts, token_to_entity, current_sent_entities
):
    """Per-sentence extraction of entities, noun chunks, units, and vocabulary."""
    sentence_text = sent.text.strip()

    # A. Process spaCy NER
    for ent in doc.ents:
        if ent.start_char >= sent.start_char and ent.end_char <= sent.end_char:
            if ent.label_ in _EXCLUDED_ENT_TYPES:
                continue
            e_text = ent.text.strip()
            if len(e_text) < 2 or _STRUCTURAL_IGNORE_RE.match(e_text):
                continue
            e_key = e_text.lower()

            if e_key not in entity_map:
                entity_map[e_key] = {
                    "text": e_text, "raw_label": ent.label_, "count": 0,
                    "first_chapter": chapter_num, "is_subject_of_human_verb": False
                }
            entity_map[e_key]["count"] += 1
            current_sent_entities.append(e_key)
            for token in ent:
                token_to_entity[token.i] = e_key

    # B. Process Noun Chunks (multi-word only become concept entities)
    for chunk_np in sent.noun_chunks:
        np_text = chunk_np.text.strip()
        np_words = np_text.split()
        if len(np_text) < 3 or len(np_words) > 3 or _STRUCTURAL_IGNORE_RE.match(np_text):
            continue
        np_key = np_text.lower()

        if len(np_words) >= 2 and zipf_frequency(np_key, 'en') < 3.5:
            if np_key not in entity_map:
                entity_map[np_key] = {
                    "text": np_text, "raw_label": "CONCEPT_CHUNK", "count": 0,
                    "first_chapter": chapter_num, "is_subject_of_human_verb": False
                }
            entity_map[np_key]["count"] += 1
            current_sent_entities.append(np_key)
            for token in chunk_np:
                token_to_entity[token.i] = np_key

    # C. Fallback: Manual unit scanner
    for token in sent:
        if token.i in token_to_entity:
            continue
        if _UNIT_PATTERN.match(token.text) and not _STRUCTURAL_IGNORE_RE.match(token.text):
            e_text = token.text
            e_key = e_text.lower()
            if e_key not in entity_map:
                entity_map[e_key] = {
                    "text": e_text, "raw_label": "CONCEPT_UNIT", "count": 0,
                    "first_chapter": chapter_num, "is_subject_of_human_verb": False
                }
            entity_map[e_key]["count"] += 1
            current_sent_entities.append(e_key)
            token_to_entity[token.i] = e_key

    # D. Dependency Agency Check
    for token in sent:
        if token.dep_ == "nsubj" and token.head.lemma_ in _HUMAN_VERBS:
            e_key = token_to_entity.get(token.i)
            if e_key:
                entity_map[e_key]["is_subject_of_human_verb"] = True

    # E. Standard Vocab
    for token in sent:
        if token.pos_ not in _VALID_POS or token.is_stop or not token.lemma_.isalpha() or len(token.lemma_) < 3:
            continue
        l_key = token.lemma_.lower()
        ent_data = entity_map.get(l_key)
        if ent_data and ent_data["raw_label"] not in (
            "CONCEPT_CHUNK", "CONCEPT_UNIT", "CONCEPT_INJECTED"
        ):
            continue
        if l_key not in lemma_data:
            lemma_data[l_key] = {
                "lemma": l_key, "pos": token.pos_, "count": 0,
                "example": sentence_text, "examples": [],
                "first_chapter": chapter_num, "chapters": [],
            }
        lemma_data[l_key]["count"] += 1
        if chapter_num > 0 and chapter_num not in lemma_data[l_key]["chapters"]:
            lemma_data[l_key]["chapters"].append(chapter_num)
        if len(lemma_data[l_key]["examples"]) < 10:
            if not lemma_data[l_key]["examples"] or lemma_data[l_key]["examples"][-1] != sentence_text:
                lemma_data[l_key]["examples"].append(sentence_text)


def _harmonize_entity_labels(entity_map, lemma_data, lowercase_counts, co_occurrence, shared_sentences):
    """Classify raw entities into Character/Location/Organization/Concept and build relationships."""
    # Inject high-value vocabulary as Concepts if sufficiently rare
    for lemma, vdata in lemma_data.items():
        if vdata["count"] >= 3:
            freq = zipf_frequency(lemma, 'en')
            if freq < 3.0:
                key = lemma.lower()
                if key not in entity_map:
                    entity_map[key] = {
                        "text": lemma,
                        "raw_label": "CONCEPT_INJECTED",
                        "count": vdata["count"],
                        "first_chapter": vdata["first_chapter"],
                        "is_subject_of_human_verb": False
                    }

    final_entities = []
    for key, data in entity_map.items():
        text = data["text"]
        is_natural = key in _NATURAL_ENTITIES
        is_unit = _UNIT_PATTERN.match(text)
        is_human_agent = data["is_subject_of_human_verb"]
        occ_count = data.get("occurrence_count") or data.get("count", 1)

        is_high_value = data["raw_label"] in ("PERSON", "GPE", "LOC") or is_natural or is_unit or is_human_agent

        if occ_count < 2 and not is_high_value:
            continue

        best_label = "Concept"
        raw = data["raw_label"]
        is_common_noun = lowercase_counts[key] > 2

        if raw == "PERSON" or is_human_agent:
            if is_natural:
                best_label = "Location"
            else:
                best_label = "Character"
        elif is_natural or raw in ("GPE", "LOC"):
            best_label = "Location"
        elif raw == "ORG":
            if is_natural or is_unit or is_common_noun:
                best_label = "Concept"
            else:
                best_label = "Organization"

        if is_unit:
            best_label = "Concept"

        if zipf_frequency(key, 'en') > 4.5 and best_label not in ("Character", "Location") and not is_natural:
            best_label = "Concept"

        rels = sorted(co_occurrence[key].items(), key=lambda x: x[1], reverse=True)[:15]
        data["label"] = best_label
        data["occurrence_count"] = occ_count
        data["relationships"] = [
            {
                "target": entity_map[r[0]]["text"],
                "weight": r[1],
                "scenes": shared_sentences[key][r[0]]
            } for r in rels if r[0] in entity_map
        ]

        for k in ["raw_label", "is_subject_of_human_verb", "count"]:
            if k in data:
                del data[k]

        final_entities.append(data)

    return final_entities


# ── Pipeline Logic ───────────────────────────────────────────────────────────

def run_pipeline(text: str, progress_callback=None) -> tuple:
    nlp = get_nlp()
    chapter_boundaries = _extract_chapter_boundaries(text)
    clean_text = _CHAPTER_MARKER_RE.sub("", text)

    CHUNK_SIZE = 50_000
    chunks = _split_into_chunks(clean_text, CHUNK_SIZE)
    total_chunks = len(chunks)

    lemma_data: dict[str, dict] = {}
    entity_map: dict[str, dict] = {}

    lowercase_counts = defaultdict(int)
    co_occurrence = defaultdict(lambda: defaultdict(int))
    shared_sentences = defaultdict(lambda: defaultdict(list))

    window_entities = []
    WINDOW_SIZE = 3

    all_docs = []
    char_offset = 0

    for i, chunk in enumerate(chunks):
        doc = nlp(chunk)
        all_docs.append(doc)

        for sent in doc.sents:
            sentence_text = sent.text.strip()
            if len(sentence_text) < 5:
                continue

            sent_start_abs = char_offset + sent.start_char
            chapter_num = _get_chapter_for_position(sent_start_abs, chapter_boundaries)

            for token in sent:
                if token.text.islower():
                    lowercase_counts[token.text] += 1

            # Extract entities and vocab for this sentence
            current_sent_entities = []
            token_to_entity = {}
            _extract_vocab_and_entities(
                doc, sent, chapter_num, entity_map, lemma_data,
                lowercase_counts, token_to_entity, current_sent_entities
            )

            # Relationship Tracking
            current_sent_entities = list(set(current_sent_entities))
            for idx, e1 in enumerate(current_sent_entities):
                for e2 in current_sent_entities[idx+1:]:
                    co_occurrence[e1][e2] += 2
                    co_occurrence[e2][e1] += 2
                    if len(shared_sentences[e1][e2]) < 5:
                        shared_sentences[e1][e2].append(sentence_text)
                        shared_sentences[e2][e1].append(sentence_text)

            window_entities.append(current_sent_entities)
            if len(window_entities) > WINDOW_SIZE:
                window_entities.pop(0)

            unique_in_window = set([e for s in window_entities for e in s])
            for e1 in current_sent_entities:
                for e2 in unique_in_window:
                    if e1 != e2:
                        co_occurrence[e1][e2] += 1
                        if sentence_text not in shared_sentences[e1][e2] and len(shared_sentences[e1][e2]) < 3:
                            shared_sentences[e1][e2].append(sentence_text)

        char_offset += len(chunk)
        if progress_callback:
            progress_callback(15 + int((i + 1) / total_chunks * 40))

    # Stage 2: Label Harmonization & Vocabulary Injection
    final_entities = _harmonize_entity_labels(
        entity_map, lemma_data, lowercase_counts,
        co_occurrence, shared_sentences
    )

    return lemma_data, final_entities, all_docs

def _extract_chapter_boundaries(text: str) -> list[tuple[int, int]]:
    boundaries = []
    offset_adjustment = 0
    for m in _CHAPTER_MARKER_RE.finditer(text):
        ch_num = int(m.group(1))
        adj_pos = m.start() - offset_adjustment
        boundaries.append((adj_pos, ch_num))
        offset_adjustment += len(m.group(0))
    return boundaries

def _get_chapter_for_position(pos: int, boundaries: list[tuple[int, int]]) -> int:
    chapter = 0
    for boundary_pos, ch_num in boundaries:
        if pos >= boundary_pos: chapter = ch_num
        else: break
    return chapter

def _split_into_chunks(text: str, chunk_size: int) -> list[str]:
    paragraphs = text.split("\n\n")
    chunks, current, current_len = [], [], 0
    for para in paragraphs:
        if len(para) > chunk_size:
            if current:
                chunks.append("\n\n".join(current))
                current, current_len = [], 0
            for i in range(0, len(para), chunk_size):
                chunks.append(para[i:i+chunk_size])
            continue
        if current_len + len(para) > chunk_size and current:
            chunks.append("\n\n".join(current))
            current, current_len = [], 0
        current.append(para)
        current_len += len(para)
    if current: chunks.append("\n\n".join(current))
    return chunks
