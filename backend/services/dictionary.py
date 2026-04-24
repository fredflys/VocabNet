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

_IRREGULAR_VERBS = {
    "be": ["am", "is", "are", "was", "were", "been", "being"],
    "have": ["has", "had", "having"],
    "do": ["does", "did", "done", "doing"],
    "go": ["goes", "went", "gone", "going"],
    "say": ["says", "said", "saying"],
    "get": ["gets", "got", "gotten", "getting"],
    "make": ["makes", "made", "making"],
    "know": ["knows", "knew", "known", "knowing"],
    "think": ["thinks", "thought", "thinking"],
    "take": ["takes", "took", "taken", "taking"],
    "see": ["sees", "saw", "seen", "seeing"],
    "come": ["comes", "came", "coming"],
    "give": ["gives", "gave", "given", "giving"],
    "find": ["finds", "found", "finding"],
    "tell": ["tells", "told", "telling"],
    "speak": ["speaks", "spoke", "spoken", "speaking"],
    "write": ["writes", "wrote", "written", "writing"],
    "run": ["runs", "ran", "running"],
    "bring": ["brings", "brought", "bringing"],
    "begin": ["begins", "began", "begun", "beginning"],
    "keep": ["keeps", "kept", "keeping"],
    "hold": ["holds", "held", "holding"],
    "stand": ["stands", "stood", "standing"],
    "hear": ["hears", "heard", "hearing"],
    "let": ["lets", "letting"],
    "put": ["puts", "putting"],
    "read": ["reads", "reading"],
    "lose": ["loses", "lost", "losing"],
    "lead": ["leads", "led", "leading"],
    "leave": ["leaves", "left", "leaving"],
    "feel": ["feels", "felt", "feeling"],
    "set": ["sets", "setting"],
    "cut": ["cuts", "cutting"],
    "show": ["shows", "showed", "shown", "showing"],
    "break": ["breaks", "broke", "broken", "breaking"],
    "drive": ["drives", "drove", "driven", "driving"],
    "buy": ["buys", "bought", "buying"],
    "pay": ["pays", "paid", "paying"],
    "meet": ["meets", "met", "meeting"],
    "sit": ["sits", "sat", "sitting"],
    "send": ["sends", "sent", "sending"],
    "fall": ["falls", "fell", "fallen", "falling"],
    "build": ["builds", "built", "building"],
    "spend": ["spends", "spent", "spending"],
    "grow": ["grows", "grew", "grown", "growing"],
    "win": ["wins", "won", "winning"],
    "teach": ["teaches", "taught", "teaching"],
    "catch": ["catches", "caught", "catching"],
    "draw": ["draws", "drew", "drawn", "drawing"],
    "choose": ["chooses", "chose", "chosen", "choosing"],
    "eat": ["eats", "ate", "eaten", "eating"],
    "fly": ["flies", "flew", "flown", "flying"],
    "drink": ["drinks", "drank", "drunk", "drinking"],
    "sing": ["sings", "sang", "sung", "singing"],
    "swim": ["swims", "swam", "swum", "swimming"],
    "lie": ["lies", "lay", "lain", "lying"],
    "rise": ["rises", "rose", "risen", "rising"],
    "throw": ["throws", "threw", "thrown", "throwing"],
    "wear": ["wears", "wore", "worn", "wearing"],
    "hide": ["hides", "hid", "hidden", "hiding"],
    "fight": ["fights", "fought", "fighting"],
    "sleep": ["sleeps", "slept", "sleeping"],
    "forget": ["forgets", "forgot", "forgotten", "forgetting"],
    "sell": ["sells", "sold", "selling"],
    "bear": ["bears", "bore", "borne", "bearing"],
    "shake": ["shakes", "shook", "shaken", "shaking"],
    "bite": ["bites", "bit", "bitten", "biting"],
    "blow": ["blows", "blew", "blown", "blowing"],
    "dig": ["digs", "dug", "digging"],
    "hang": ["hangs", "hung", "hanging"],
    "hit": ["hits", "hitting"],
    "hurt": ["hurts", "hurting"],
    "lay": ["lays", "laid", "laying"],
    "light": ["lights", "lit", "lighting"],
    "quit": ["quits", "quitting"],
    "ride": ["rides", "rode", "ridden", "riding"],
    "ring": ["rings", "rang", "rung", "ringing"],
    "seek": ["seeks", "sought", "seeking"],
    "shoot": ["shoots", "shot", "shooting"],
    "shut": ["shuts", "shutting"],
    "spread": ["spreads", "spreading"],
    "steal": ["steals", "stole", "stolen", "stealing"],
    "stick": ["sticks", "stuck", "sticking"],
    "strike": ["strikes", "struck", "striking"],
    "swear": ["swears", "swore", "sworn", "swearing"],
    "sweep": ["sweeps", "swept", "sweeping"],
    "tear": ["tears", "tore", "torn", "tearing"],
    "wake": ["wakes", "woke", "woken", "waking"],
}

_IRREGULAR_NOUNS = {
    "child": ["children"],
    "man": ["men"],
    "woman": ["women"],
    "foot": ["feet"],
    "tooth": ["teeth"],
    "goose": ["geese"],
    "mouse": ["mice"],
    "louse": ["lice"],
    "person": ["people", "persons"],
    "ox": ["oxen"],
    "leaf": ["leaves"],
    "life": ["lives"],
    "knife": ["knives"],
    "wife": ["wives"],
    "half": ["halves"],
    "self": ["selves"],
    "calf": ["calves"],
    "wolf": ["wolves"],
    "shelf": ["shelves"],
    "loaf": ["loaves"],
    "thief": ["thieves"],
    "sheep": [],
    "deer": [],
    "fish": [],
    "species": [],
    "series": [],
    "crisis": ["crises"],
    "analysis": ["analyses"],
    "thesis": ["theses"],
    "hypothesis": ["hypotheses"],
    "phenomenon": ["phenomena"],
    "criterion": ["criteria"],
    "datum": ["data"],
    "medium": ["media"],
    "cactus": ["cacti", "cactuses"],
    "focus": ["foci", "focuses"],
    "fungus": ["fungi", "funguses"],
    "nucleus": ["nuclei"],
    "stimulus": ["stimuli"],
    "syllabus": ["syllabi", "syllabuses"],
}


def _apply_verb_suffix(word: str) -> set[str]:
    """Generate regular verb inflections with spelling rules."""
    forms = set()
    # -s / -es
    if word.endswith(("s", "sh", "ch", "x", "z", "o")):
        forms.add(word + "es")
    elif word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
        forms.add(word[:-1] + "ies")
    else:
        forms.add(word + "s")
    # -ed
    if word.endswith("e"):
        forms.add(word + "d")
    elif word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
        forms.add(word[:-1] + "ied")
    elif len(word) >= 3 and word[-1] not in "aeiouwxy" and word[-2] in "aeiou" and word[-3] not in "aeiou":
        forms.add(word + word[-1] + "ed")
    else:
        forms.add(word + "ed")
    # -ing
    if word.endswith("ie"):
        forms.add(word[:-2] + "ying")
    elif word.endswith("e") and not word.endswith("ee"):
        forms.add(word[:-1] + "ing")
    elif len(word) >= 3 and word[-1] not in "aeiouwxy" and word[-2] in "aeiou" and word[-3] not in "aeiou":
        forms.add(word + word[-1] + "ing")
    else:
        forms.add(word + "ing")
    return forms


def _apply_noun_suffix(word: str) -> set[str]:
    """Generate regular noun plural with spelling rules."""
    forms = set()
    if word.endswith(("s", "sh", "ch", "x", "z")):
        forms.add(word + "es")
    elif word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
        forms.add(word[:-1] + "ies")
    elif word.endswith("f"):
        forms.add(word[:-1] + "ves")
        forms.add(word + "s")
    elif word.endswith("fe"):
        forms.add(word[:-2] + "ves")
    else:
        forms.add(word + "s")
    return forms


def get_inflections(word: str) -> list[str]:
    """Generate common inflections for a lemma using irregulars lookup + spelling rules."""
    from services.nlp import get_nlp
    nlp = get_nlp()
    doc = nlp(word)
    if not doc:
        return [word]

    token = doc[0]
    forms = {word.lower()}

    if token.pos_ == "VERB":
        if word.lower() in _IRREGULAR_VERBS:
            forms.update(_IRREGULAR_VERBS[word.lower()])
        else:
            forms.update(_apply_verb_suffix(word.lower()))
    elif token.pos_ == "NOUN":
        if word.lower() in _IRREGULAR_NOUNS:
            forms.update(_IRREGULAR_NOUNS[word.lower()])
        else:
            forms.update(_apply_noun_suffix(word.lower()))

    return sorted(forms)

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
