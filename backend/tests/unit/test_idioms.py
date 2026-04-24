import pytest
from unittest.mock import patch
from services.idioms import detect_idioms, detect_phrasal_verbs, detect_collocations


def test_idiom_detection_with_known_phrases():
    """Idioms present in the database should be detected."""
    mock_db = {
        "break the ice": {"meaning": "To initiate social interaction", "cefr": "B2", "tip": "Think of literally breaking ice", "example": "She broke the ice with a joke."},
        "hit the road": {"meaning": "To leave or start a journey", "cefr": "B1"},
    }
    with patch("services.idioms._load_idioms", return_value=mock_db):
        text = "She decided to break the ice at the party. Then they hit the road."
        results = detect_idioms(text)

        lemmas = {r["lemma"] for r in results}
        assert "break the ice" in lemmas
        assert "hit the road" in lemmas

        for r in results:
            assert r["is_idiom"] is True
            assert r["idiom_type"] == "idiom"
            assert r["count"] >= 1


def test_idiom_not_found():
    """Idioms not in text should not appear in results."""
    mock_db = {
        "break the ice": {"meaning": "To initiate social interaction"},
    }
    with patch("services.idioms._load_idioms", return_value=mock_db):
        text = "The weather is nice today."
        results = detect_idioms(text)
        assert len(results) == 0


def test_idiom_with_lemma_filter():
    """When lemma_keys is provided, idioms whose words aren't in the set should be skipped."""
    mock_db = {
        "break the ice": {"meaning": "To initiate social interaction"},
    }
    with patch("services.idioms._load_idioms", return_value=mock_db):
        text = "She decided to break the ice at the party."
        # Missing 'ice' from lemma_keys
        results = detect_idioms(text, lemma_keys={"break", "the"})
        assert len(results) == 0

        # All words present
        results = detect_idioms(text, lemma_keys={"break", "the", "ice"})
        assert len(results) == 1


def test_phrasal_verb_extraction():
    """Phrasal verbs should be extracted from spaCy docs."""
    from services.nlp import get_nlp
    nlp = get_nlp()

    mock_pv_set = {"give up", "look after", "turn off"}
    with patch("services.idioms._load_phrasal_verbs", return_value=mock_pv_set):
        doc = nlp("He decided to give up smoking.")
        results = detect_phrasal_verbs(doc)

        if results:
            for r in results:
                assert r["is_idiom"] is True
                assert r["idiom_type"] == "phrasal_verb"


def test_collocation_matching():
    """Collocations should be matched from the collocation list."""
    mock_colls = ["make progress", "take advantage"]
    with patch("services.idioms._load_collocations", return_value=mock_colls):
        text = "Students need to make progress in their studies."
        results = detect_collocations(text)

        lemmas = {r["lemma"] for r in results}
        assert "make progress" in lemmas

        for r in results:
            assert r["is_idiom"] is True
            assert r["idiom_type"] == "collocation"


def test_empty_text_no_matches():
    """Empty text should produce no results."""
    mock_db = {"break the ice": {"meaning": "test"}}
    with patch("services.idioms._load_idioms", return_value=mock_db):
        results = detect_idioms("")
        assert results == []

    with patch("services.idioms._load_collocations", return_value=["make progress"]):
        results = detect_collocations("")
        assert results == []


def test_collocation_no_match():
    """Collocations not in text should not appear."""
    mock_colls = ["make progress"]
    with patch("services.idioms._load_collocations", return_value=mock_colls):
        text = "The sky is blue."
        results = detect_collocations(text)
        assert len(results) == 0


def test_idiom_examples_collected():
    """Idiom matches should include example sentences."""
    mock_db = {
        "break the ice": {"meaning": "To initiate social interaction"},
    }
    with patch("services.idioms._load_idioms", return_value=mock_db):
        text = "She decided to break the ice at the party. He also wanted to break the ice."
        results = detect_idioms(text)

        assert len(results) == 1
        assert len(results[0]["examples"]) >= 1
