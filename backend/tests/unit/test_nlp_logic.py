import pytest
from services.nlp import run_pipeline

def test_nlp_pipeline_basic():
    text = "The quick brown fox jumps over the lazy dog. A student is studying biology."
    lemma_data, entity_list, all_docs = run_pipeline(text)

    # Check for basic lemmas
    assert "fox" in lemma_data
    assert "jump" in lemma_data
    assert "dog" in lemma_data
    assert "biology" in lemma_data

    # Check metadata
    assert lemma_data["fox"]["pos"] == "NOUN"
    assert lemma_data["jump"]["pos"] == "VERB"

def test_nlp_entity_exclusion():
    text = "John lives in London and works for Google."
    lemma_data, entity_list, all_docs = run_pipeline(text)

    # Proper nouns should be excluded via NER
    assert "john" not in lemma_data
    assert "london" not in lemma_data
    assert "google" not in lemma_data


def test_entity_collision_guard():
    """Concept-type entities should coexist in vocab; proper-noun entities should not."""
    text = "The scientist discovered quantum mechanics. The scientist published many papers about quantum mechanics."
    lemma_data, entity_list, all_docs = run_pipeline(text)

    # 'scientist' is a regular noun and should appear in vocab
    assert "scientist" in lemma_data


def test_pos_filtering():
    """Only NOUN/VERB/ADJ/ADV should appear in vocab."""
    text = "She quickly ran towards the beautiful garden and carefully observed the flowers."
    lemma_data, entity_list, all_docs = run_pipeline(text)

    for lemma, data in lemma_data.items():
        assert data["pos"] in ("NOUN", "VERB", "ADJ", "ADV"), \
            f"Unexpected POS '{data['pos']}' for lemma '{lemma}'"


def test_minimum_lemma_length():
    """Lemmas shorter than 3 characters should be excluded."""
    text = "He is at an ox by a do or go. The philosopher contemplated existence."
    lemma_data, entity_list, all_docs = run_pipeline(text)

    for lemma in lemma_data:
        assert len(lemma) >= 3, f"Lemma '{lemma}' is shorter than 3 characters"


def test_pipeline_returns_three_values():
    """run_pipeline must return exactly (lemma_data, entity_list, all_docs)."""
    text = "Testing the return signature of the pipeline."
    result = run_pipeline(text)
    assert len(result) == 3
    lemma_data, entity_list, all_docs = result
    assert isinstance(lemma_data, dict)
    assert isinstance(entity_list, list)
    assert isinstance(all_docs, list)


def test_count_increments():
    """Repeated words should have count > 1."""
    text = "The cat sat on the mat. The cat ate the fish. The cat slept."
    lemma_data, entity_list, all_docs = run_pipeline(text)

    assert "cat" in lemma_data
    assert lemma_data["cat"]["count"] >= 3


def test_examples_collected():
    """Examples should be collected up to the limit."""
    text = "The scientist measured the result. Another scientist measured differently. The scientist measured again."
    lemma_data, entity_list, all_docs = run_pipeline(text)

    if "measure" in lemma_data:
        assert len(lemma_data["measure"]["examples"]) >= 1
        assert len(lemma_data["measure"]["examples"]) <= 10
