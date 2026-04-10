"""
Idiom, phrasal verb, and collocation detection.
"""
import json
import re
from pathlib import Path

_DATA_DIR = Path(__file__).parent.parent / "data"

_idiom_db: dict | None = None
_phrasal_verbs: set | None = None
_collocations: list | None = None


def _load_idioms() -> dict:
    global _idiom_db
    if _idiom_db is not None:
        return _idiom_db
    path = _DATA_DIR / "idioms.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            _idiom_db = json.load(f)
    else:
        _idiom_db = {}
    return _idiom_db


def _load_phrasal_verbs() -> set:
    global _phrasal_verbs
    if _phrasal_verbs is not None:
        return _phrasal_verbs
    path = _DATA_DIR / "phrasal_verbs.txt"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            _phrasal_verbs = {line.strip().lower() for line in f if line.strip()}
    else:
        _phrasal_verbs = set()
    return _phrasal_verbs

def _load_collocations() -> list:
    global _collocations
    if _collocations is not None:
        return _collocations
    path = _DATA_DIR / "collocations.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            _collocations = json.load(f)
    else:
        _collocations = []
    return _collocations


def detect_idioms(text: str, lemma_keys: set[str] = None) -> list[dict]:
    """Pass 1: Match text against curated idiom dictionary."""
    db = _load_idioms()
    matches = []
    seen = set()

    for phrase, info in db.items():
        phrase_lower = phrase.lower()
        if phrase_lower in seen:
            continue
            
        if lemma_keys is not None:
            required_words = {w for w in re.findall(r'[a-z]+', phrase_lower)}
            if not required_words.issubset(lemma_keys):
                continue

        pattern = re.compile(r'\b' + re.escape(phrase_lower) + r'\b', re.IGNORECASE)
        found = pattern.findall(text)

        if found:
            seen.add(phrase_lower)
            examples = _find_all_sentences(text, phrase_lower)
            matches.append({
                "lemma": phrase.lower(),
                "is_idiom": True,
                "idiom_type": "idiom",
                "pos": "PHRASE",
                "count": len(found),
                "example": examples[0] if examples else "",
                "examples": examples,
                "definition": info.get("meaning", ""),
                "cefr": info.get("cefr", "C1"),
                "phonetics": "",
                "simple_def": "",
                "memory_tip": info.get("tip", ""),
                "llm_example": info.get("example", ""),
                "translation": "",
                "has_llm": False,
                "api_example": "",
            })

    return matches


def detect_phrasal_verbs(doc) -> list[dict]:
    """Pass 2: Detect phrasal verbs from spaCy Doc."""
    pv_set = _load_phrasal_verbs()
    if not pv_set:
        return []

    candidates: dict[str, dict] = {}

    for token in doc:
        if token.pos_ != "VERB":
            continue
        for child in token.children:
            if child.dep_ in ("prt", "prep", "advmod") and child.pos_ in ("ADP", "PART", "ADV"):
                pv = f"{token.lemma_.lower()} {child.text.lower()}"
                if pv in pv_set and pv not in candidates:
                    sent = token.sent.text.strip()
                    candidates[pv] = {
                        "lemma": pv,
                        "is_idiom": True,
                        "idiom_type": "phrasal_verb",
                        "pos": "PHRASAL_VERB",
                        "count": 1,
                        "example": sent,
                        "examples": [sent],
                        "definition": "",
                        "cefr": "B2",
                        "phonetics": "",
                        "simple_def": "",
                        "memory_tip": "",
                        "llm_example": "",
                        "translation": "",
                        "has_llm": False,
                        "api_example": "",
                    }
                elif pv in pv_set and pv in candidates:
                    candidates[pv]["count"] += 1
                    sent = token.sent.text.strip()
                    if sent not in candidates[pv]["examples"] and len(candidates[pv]["examples"]) < 50:
                        candidates[pv]["examples"].append(sent)

    return list(candidates.values())

def detect_collocations(text: str) -> list[dict]:
    """Pass 3: Match text against common collocations."""
    colls = _load_collocations()
    matches = []
    for c in colls:
        pattern = re.compile(r'\b' + re.escape(c) + r'\b', re.IGNORECASE)
        found = pattern.findall(text)
        if found:
            examples = _find_all_sentences(text, c)
            matches.append({
                "lemma": c.lower(),
                "is_idiom": True,
                "idiom_type": "collocation",
                "pos": "COLLOCATION",
                "count": len(found),
                "example": examples[0] if examples else "",
                "examples": examples,
                "definition": f"Common phrase: {c}",
                "cefr": "B1",
                "phonetics": "",
                "simple_def": "",
                "memory_tip": "",
                "llm_example": "",
                "translation": "",
                "has_llm": False,
                "api_example": "",
            })
    return matches


def _find_all_sentences(text: str, phrase: str, max_count: int = 50) -> list[str]:
    """Find full sentences containing the phrase."""
    pattern = re.compile(r'[^.!?\n]*\b' + re.escape(phrase) + r'\b[^.!?\n]*[.!?]?', re.IGNORECASE)
    matches = []
    for m in pattern.finditer(text):
        s = m.group(0).strip()
        s = re.sub(r'^\s+', '', s)
        if s and s not in matches:
            matches.append(s)
            if len(matches) >= max_count:
                break
    return matches
