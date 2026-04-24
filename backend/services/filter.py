"""
Difficulty filter: applies wordfreq Zipf frequency filtering to estimate CEFR level.
"""
from wordfreq import zipf_frequency

# CEFR level ordering — lower index = easier
_CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]


def _get_cefr_for_zipf(zipf: float) -> str:
    """
    Map a Zipf frequency to an approximate CEFR level.
    Zipf scale is logarithmic base 10 per billion words:
    - ~5.2+ = Ultra common ("the", "dog") -> A1
    - ~4.2+ = Common, basic vocab ("student", "apple") -> A2
    - ~3.2+ = Intermediate ("subtle", "investigate") -> B1
    - ~2.2+ = Upper intermediate ("diminish", "elaborate") -> B2
    - ~1.2+ = Advanced ("ephemeral", "pragmatic") -> C1
    - < 1.2/0.0 = Mastery / Rare / Unknown -> C2
    """
    if zipf == 0.0:  # Not found
        return "C2"
    if zipf >= 5.2: return "A1"
    if zipf >= 4.2: return "A2"
    if zipf >= 3.2: return "B1"
    if zipf >= 2.2: return "B2"
    if zipf >= 1.2: return "C1"
    return "C2"


def is_difficult(lemma: str, user_level: str = "B1") -> tuple[bool, str | None]:
    """
    Returns (is_difficult, cefr_level).
    A word is considered "difficult" if its estimated CEFR level 
    is strictly higher than the user's known level.
    """
    zipf = zipf_frequency(lemma, 'en')
    cefr = _get_cefr_for_zipf(zipf)
    
    user_idx = _CEFR_ORDER.index(user_level) if user_level in _CEFR_ORDER else 2
    word_idx = _CEFR_ORDER.index(cefr)
    
    # It is difficult if the word's level index is greater than user's level
    return word_idx > user_idx, cefr


def filter_vocabulary(
    lemma_data: dict,
    user_level: str = "B1",
    top_n: int = 3000,
) -> list[dict]:
    """
    Filter and rank the vocabulary with difficulty-aware prioritization.

    ALL words above the user's CEFR level are kept unconditionally — these
    are the difficult words the tool exists to surface. The top_n cap only
    applies to words at or below the user's level, which fills the remaining
    slots sorted by in-book frequency. Easy words are still included so
    level-based UI filters always show data.
    """
    results = []

    for lemma, data in lemma_data.items():
        difficult, cefr = is_difficult(lemma, user_level)
        results.append({
            **data,
            "cefr": cefr or "?",
            "is_difficult": difficult
        })

    # Partition: difficult words always survive the cap
    above_level = [w for w in results if w["is_difficult"]]
    at_or_below = [w for w in results if not w["is_difficult"]]

    # Sort each partition by in-book frequency for display ordering
    above_level.sort(key=lambda x: x["count"], reverse=True)
    at_or_below.sort(key=lambda x: x["count"], reverse=True)

    # Cap only applies to easier words
    remaining = max(0, top_n - len(above_level))
    return above_level + at_or_below[:remaining]
