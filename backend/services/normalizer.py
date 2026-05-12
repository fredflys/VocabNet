"""
Dialect & informal speech normalization.

Layer 1 (normalize_text): regex / static-map replacements on raw text
    before spaCy processes it.
Layer 2 (normalize_lemma): dict lookup on token.lemma_ after spaCy,
    consolidating non-standard lemmas with their standard forms.
"""

import re
from wordfreq import zipf_frequency

# ── Layer 1 constants ────────────────────────────────────────────────────────

# Dropped-g pattern: fetchin' → fetching, runnin' → running
_DROPPED_G_RE = re.compile(r"\b([a-zA-Z]{2,})in['\u2019](?=\s|[.!?,;:\"\)\]\-]|$)")

# Archaic / poetic contractions
_ARCHAIC_MAP = {
    "'twas":  "it was",
    "'tis":   "it is",
    "o'er":   "over",
    "e'er":   "ever",
    "ne'er":  "never",
    "e'en":   "even",
    "ev'ry":  "every",
    "heav'n": "heaven",
}

# Clipped / aphetic forms (leading apostrophe)
_CLIPPED_MAP = {
    "'fraid":   "afraid",
    "'cept":    "except",
    "'fore":    "before",
    "'til":     "until",
    "'bout":    "about",
    "'cause":   "because",
    "'round":   "around",
    "'neath":   "beneath",
    "'nother":  "another",
}

# Informal speech fusions that spaCy mishandles (pre-spaCy)
_INFORMAL_PRE_MAP = {
    "lemme":  "let me",
    "gimme":  "give me",
    "c'mon":  "come on",
    "d'you":  "do you",
}

# Build combined map for archaic + clipped + informal pre-maps,
# duplicating entries for curly-apostrophe variants
_LAYER1_STATIC: dict[str, str] = {}
for _src_map in (_ARCHAIC_MAP, _CLIPPED_MAP, _INFORMAL_PRE_MAP):
    for _k, _v in _src_map.items():
        _LAYER1_STATIC[_k] = _v
        # Add curly apostrophe variant
        _LAYER1_STATIC[_k.replace("'", "\u2019")] = _v

# Sort longest-first to prevent partial matches
_LAYER1_KEYS_SORTED = sorted(_LAYER1_STATIC.keys(), key=len, reverse=True)

# Compile a single regex for all static Layer 1 patterns (case-insensitive)
_LAYER1_STATIC_RE = re.compile(
    r"(?<!\w)(" + "|".join(re.escape(k) for k in _LAYER1_KEYS_SORTED) + r")(?!\w)",
    re.IGNORECASE,
)


# ── Layer 2 constants ────────────────────────────────────────────────────────

# Informal lemma remap (post-spaCy)
_LEMMA_REMAP: dict[str, str] = {
    "wanna":    "want",
    "dunno":    "know",
    "kinda":    "kind",
    "sorta":    "sort",
    "hafta":    "have",
    "shoulda":  "should",
    "coulda":   "could",
    "woulda":   "would",
    "musta":    "must",
    "mighta":   "might",
    "oughta":   "ought",
}

# Eye-dialect remap (only applied when the lemma's zipf < 3.5)
_EYE_DIALECT_REMAP: dict[str, str] = {
    "yer":     "your",
    "yeh":     "you",
    "fer":     "for",
    "nowt":    "nothing",
    "summat":  "something",
    "nuffin":  "nothing",
    "nuffink": "nothing",
    "sez":     "say",
    "wuz":     "was",
    "woz":     "was",
}


# ── Layer 1 function ─────────────────────────────────────────────────────────

def normalize_text(text: str) -> str:
    """Pre-spaCy text normalization (Layer 1).

    Applied after chapter markers are stripped, before spaCy tokenization.
    """
    # 1. Dropped-g contractions with zipf validation guard
    def _dropped_g_replace(m: re.Match) -> str:
        stem = m.group(1)
        candidate = stem + "ing"
        # Only substitute if the -ing form is more frequent than the -in form
        if zipf_frequency(candidate.lower(), "en") > zipf_frequency((stem + "in").lower(), "en"):
            return candidate
        return m.group(0)  # leave unchanged

    text = _DROPPED_G_RE.sub(_dropped_g_replace, text)

    # 2. Static map replacements (archaic, clipped, informal)
    def _static_replace(m: re.Match) -> str:
        matched = m.group(0)
        replacement = _LAYER1_STATIC.get(matched.lower())
        if replacement is None:
            return matched
        # Preserve leading capitalisation (skip past leading apostrophe)
        first_alpha = next((c for c in matched if c.isalpha()), "")
        if first_alpha.isupper():
            return replacement.capitalize()
        return replacement

    text = _LAYER1_STATIC_RE.sub(_static_replace, text)

    return text


# ── Layer 2 function ─────────────────────────────────────────────────────────

def normalize_lemma(lemma: str) -> str:
    """Post-spaCy lemma normalization (Layer 2).

    Applied per-token after spaCy processing, on the lowered lemma.
    """
    # 1. Direct informal remap
    mapped = _LEMMA_REMAP.get(lemma)
    if mapped is not None:
        return mapped

    # 2. Eye-dialect remap with zipf guard
    mapped = _EYE_DIALECT_REMAP.get(lemma)
    if mapped is not None:
        if zipf_frequency(lemma, "en") < 3.5:
            return mapped

    return lemma
