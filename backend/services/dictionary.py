import json
import httpx
from datetime import datetime
from abc import ABC, abstractmethod
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.dict_repository import DictRepository

# ── Global Connection Pooling ────────────────────────────────────────────────
_http_client = httpx.AsyncClient(
    limits=httpx.Limits(max_keepalive_connections=50, max_connections=100),
    timeout=8.0
)

# ── Provider interface ───────────────────────────────────────────────────────

class DictionaryProvider(ABC):
    name: str = "unknown"

    @abstractmethod
    async def resolve(self, word: str) -> dict | None:
        pass


class FreeDictionaryAPIProvider(DictionaryProvider):
    name = "FreeDictionaryAPI.com"
    BASE_URL = "https://freedictionaryapi.com/api/v1/en"

    async def resolve(self, word: str) -> dict | None:
        try:
            resp = await _http_client.get(f"{self.BASE_URL}/{word}")
            if resp.status_code != 200:
                return None
            return self._parse(resp.json())
        except Exception:
            return None

    def _parse(self, data: dict) -> dict | None:
        entries = data.get("entries", [])
        if not entries: return None
        definition, example, pos, phonetics = "", "", "", ""
        all_meanings = []
        for entry in entries:
            entry_pos = entry.get("partOfSpeech", "")
            if not pos: pos = entry_pos
            if not phonetics:
                for pron in entry.get("pronunciations", []):
                    if text := pron.get("text", ""):
                        phonetics = text
                        break
            senses = entry.get("senses", [])
            if senses:
                meaning_block = {"partOfSpeech": entry_pos, "definitions": []}
                for sense in senses:
                    sense_def = sense.get("definition", "")
                    sense_ex = sense.get("examples", [""])[0] if sense.get("examples") else ""
                    if sense_def:
                        meaning_block["definitions"].append({"definition": sense_def, "example": sense_ex})
                    if not definition and sense_def: definition = sense_def
                    if not example and sense_ex: example = sense_ex
                if meaning_block["definitions"]:
                    all_meanings.append(meaning_block)
        if not definition and not all_meanings: return None
        return {
            "definition": definition,
            "phonetics": phonetics,
            "api_example": example,
            "pos": pos,
            "source": self.name,
            "all_meanings": all_meanings,
        }

class DictionaryAPIDevProvider(DictionaryProvider):
    name = "dictionaryapi.dev"
    BASE_URL = "https://api.dictionaryapi.dev/api/v2/entries/en"

    async def resolve(self, word: str) -> dict | None:
        try:
            resp = await _http_client.get(f"{self.BASE_URL}/{word}")
            if resp.status_code != 200:
                return None
            return self._parse(resp.json())
        except Exception:
            return None

    def _parse(self, data: list) -> dict | None:
        if not data: return None
        entry = data[0]
        phonetics = next((ph["text"] for ph in entry.get("phonetics", []) if ph.get("text")), "")
        definition, example, pos = "", "", ""
        all_meanings = []
        for meaning in entry.get("meanings", []):
            meaning_pos = meaning.get("partOfSpeech", "")
            if not pos: pos = meaning_pos
            meaning_block = {"partOfSpeech": meaning_pos, "definitions": []}
            for def_item in meaning.get("definitions", []):
                def_text = def_item.get("definition", "")
                def_ex = def_item.get("example", "")
                if def_text:
                    meaning_block["definitions"].append({"definition": def_text, "example": def_ex})
                if not definition and def_text: definition = def_text
                if not example and def_ex: example = def_ex
            if meaning_block["definitions"]:
                all_meanings.append(meaning_block)
        if not definition and not all_meanings: return None
        return {
            "definition": definition,
            "phonetics": phonetics,
            "api_example": example,
            "pos": pos,
            "source": self.name,
            "all_meanings": all_meanings,
        }

PROVIDERS: list[DictionaryProvider] = [
    FreeDictionaryAPIProvider(),
    DictionaryAPIDevProvider(),
]

_EMPTY_RESULT = {
    "definition": "", "phonetics": "", "api_example": "",
    "pos": "", "source": "", "all_meanings": [],
}

def get_inflections(word: str) -> list[str]:
    """Use spaCy to generate common inflections for a lemma."""
    from services.nlp import get_nlp
    nlp = get_nlp()
    doc = nlp(word)
    if not doc: return [word]
    
    token = doc[0]
    # We use the lexeme from the spaCy vocab to find common forms
    # This is a lightweight heuristic approach
    forms = {word.lower()}
    
    # Check common English suffixes for the base word
    # (Since sm model doesn't have a full generator, we use a heuristic)
    if token.pos_ == "VERB":
        forms.update({word + 's', word + 'ed', word + 'ing'})
    elif token.pos_ == "NOUN":
        forms.update({word + 's', word + 'es'})
        
    return sorted(list(forms))

async def get_definition(word: str, session: AsyncSession) -> dict:
    repo = DictRepository(session)
    cached = await repo.get_by_lemma(word)
    if cached is not None:
        return cached

    result = None
    for provider in PROVIDERS:
        result = await provider.resolve(word)
        if result and result.get("definition"):
            break

    if not result:
        result = {**_EMPTY_RESULT}
    
    # Add inflections for the highlighter
    result["inflections"] = get_inflections(word)
    
    await repo.upsert(word, result)
    return result

async def fetch_definitions_batch(words: list[str], session: AsyncSession) -> dict[str, dict]:
    results = {}
    for word in words:
        results[word] = await get_definition(word, session)
    return results
