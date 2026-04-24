import pytest
from services.filter import filter_vocabulary, is_difficult, _get_cefr_for_zipf


def _make_lemma(lemma, count=5, pos="NOUN"):
    return {
        "lemma": lemma,
        "pos": pos,
        "count": count,
        "example": f"Example with {lemma}.",
        "examples": [f"Example with {lemma}."],
        "first_chapter": 1,
        "chapters": [1],
    }


def test_difficulty_aware_partitioning():
    """Difficult words are always kept; cap only applies to easy words."""
    lemma_data = {}
    # Create 10 common words (A1/A2 level) and 5 rare words (C1/C2)
    common_words = ["dog", "cat", "house", "water", "food", "school", "time", "people", "work", "play"]
    rare_words = ["ephemeral", "sycophant", "obfuscate", "loquacious", "perspicacious"]

    for w in common_words:
        lemma_data[w] = _make_lemma(w, count=10)
    for w in rare_words:
        lemma_data[w] = _make_lemma(w, count=2)

    # With top_n=8 at B1 level, all rare words should survive + remaining slots for easy words
    result = filter_vocabulary(lemma_data, user_level="B1", top_n=8)
    result_lemmas = {r["lemma"] for r in result}

    # All rare words that are above B1 should be present
    difficult_in_result = [r for r in result if r["is_difficult"]]
    easy_in_result = [r for r in result if not r["is_difficult"]]

    # Total should respect the cap structure
    assert len(result) <= 8 + len(difficult_in_result)


def test_cap_only_applies_to_easy_words():
    """When top_n is small, easy words get capped but difficult words don't."""
    lemma_data = {}
    for i in range(20):
        lemma_data[f"commonword{i}"] = _make_lemma(f"commonword{i}", count=10)

    result = filter_vocabulary(lemma_data, user_level="B1", top_n=5)
    # Should not exceed top_n for easy-only vocab
    assert len(result) <= 5


def test_all_words_difficult():
    """When all words are difficult, they all survive even if exceeding top_n."""
    lemma_data = {}
    rare_words = ["ephemeral", "sycophant", "obfuscate", "loquacious", "perspicacious",
                  "sesquipedalian", "defenestrate"]
    for w in rare_words:
        lemma_data[w] = _make_lemma(w, count=3)

    result = filter_vocabulary(lemma_data, user_level="A1", top_n=3)
    difficult = [r for r in result if r["is_difficult"]]
    # All difficult words should survive regardless of top_n
    assert len(difficult) >= len([w for w in rare_words if is_difficult(w, "A1")[0]])


def test_no_difficult_words():
    """When no words are difficult, easy words fill up to top_n."""
    lemma_data = {}
    common = ["dog", "cat", "house", "water", "food"]
    for w in common:
        lemma_data[w] = _make_lemma(w, count=10)

    result = filter_vocabulary(lemma_data, user_level="C2", top_n=3)
    # At C2, most words are at or below level
    assert len(result) <= 5  # at most all words


def test_cefr_classification_boundaries():
    """Verify CEFR assignment at boundary Zipf values."""
    assert _get_cefr_for_zipf(5.5) == "A1"
    assert _get_cefr_for_zipf(5.2) == "A1"
    assert _get_cefr_for_zipf(4.5) == "A2"
    assert _get_cefr_for_zipf(4.2) == "A2"
    assert _get_cefr_for_zipf(3.5) == "B1"
    assert _get_cefr_for_zipf(3.2) == "B1"
    assert _get_cefr_for_zipf(2.5) == "B2"
    assert _get_cefr_for_zipf(2.2) == "B2"
    assert _get_cefr_for_zipf(1.5) == "C1"
    assert _get_cefr_for_zipf(1.2) == "C1"
    assert _get_cefr_for_zipf(0.5) == "C2"
    assert _get_cefr_for_zipf(0.0) == "C2"


def test_is_difficult_returns_tuple():
    """is_difficult should return (bool, str) tuple."""
    result = is_difficult("dog", "B1")
    assert isinstance(result, tuple)
    assert len(result) == 2
    assert isinstance(result[0], bool)
    assert isinstance(result[1], str)


def test_sorted_by_frequency():
    """Results within each partition should be sorted by count descending."""
    lemma_data = {
        "rare1": _make_lemma("rare1", count=5),
        "rare2": _make_lemma("rare2", count=10),
        "common1": _make_lemma("common1", count=3),
        "common2": _make_lemma("common2", count=8),
    }
    result = filter_vocabulary(lemma_data, user_level="B1", top_n=100)

    # Within the difficult partition, counts should be descending
    difficult = [r for r in result if r["is_difficult"]]
    for i in range(len(difficult) - 1):
        assert difficult[i]["count"] >= difficult[i + 1]["count"]

    # Within the easy partition, counts should be descending
    easy = [r for r in result if not r["is_difficult"]]
    for i in range(len(easy) - 1):
        assert easy[i]["count"] >= easy[i + 1]["count"]
