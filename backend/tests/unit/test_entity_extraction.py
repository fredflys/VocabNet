import pytest
from services.nlp import run_pipeline

def test_entity_refinement_heuristics():
    # Test text addressing the specific issues reported:
    # 1. Dirac (Character via agency)
    # 2. Sun/Universe (Location/Concept via Natural Set)
    # 3. MeV (Concept via Unit Pattern)
    text = """
    Dirac calculated the energy of the electron. 
    The Sun is a star in the middle of our solar system. 
    The particles had an energy of 500 MeV.
    The Universe is expanding rapidly.
    Dirac said that quantum mechanics is beautiful.
    """
    lemma_data, entity_list, all_docs = run_pipeline(text)
    
    # 1. Dirac should be a Character (Subject of 'calculated' and 'said')
    dirac = next((e for e in entity_list if "Dirac" in e["text"]), None)
    assert dirac is not None
    assert dirac["label"] == "Character"
    
    # 2. Sun should be a Location (via _NATURAL_ENTITIES)
    sun = next((e for e in entity_list if "Sun" in e["text"]), None)
    assert sun is not None
    assert sun["label"] == "Location"
    
    # 3. MeV should be a Concept (via _UNIT_PATTERN)
    # We use '500MeV' or ensure the token matches the regex scan
    mev = next((e for e in entity_list if "500 MeV" in e["text"] or "MeV" in e["text"]), None)
    assert mev is not None
    assert mev["label"] == "Concept"

    # 4. Universe should be a Location (via _NATURAL_ENTITIES)
    universe = next((e for e in entity_list if "Universe" in e["text"]), None)
    assert universe is not None
    assert universe["label"] == "Location"

def test_entity_relationships():
    # Harry and Hermione should be linked
    text = "Harry and Hermione are friends. Harry and Hermione study together."
    lemma_data, entity_list, all_docs = run_pipeline(text)
    
    harry = next((e for e in entity_list if "Harry" in e["text"]), None)
    assert harry is not None
    
    # Check relationships
    rel_targets = [r["target"] for r in harry["relationships"]]
    assert any("Hermione" in t for t in rel_targets)
    
    # Check shared scenes are captured
    rel = next(r for r in harry["relationships"] if "Hermione" in r["target"])
    assert len(rel["scenes"]) > 0
