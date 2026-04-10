import pytest
from services.nlp import run_pipeline

def test_nlp_pipeline_basic():
    text = "The quick brown fox jumps over the lazy dog. A student is studying biology."
    lemma_data, all_docs = run_pipeline(text)
    
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
    lemma_data, all_docs = run_pipeline(text)
    
    # Proper nouns should be excluded via NER
    assert "john" not in lemma_data
    assert "london" not in lemma_data
    assert "google" not in lemma_data
