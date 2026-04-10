import pytest
from models import DictCache
from sqlalchemy import select
from services.dictionary import FreeDictionaryAPIProvider

@pytest.mark.asyncio
async def test_dictionary_lookup_with_mock(client, session, mocker):
    # Mock the resolve method of the first provider
    # We patch the instance method resolve of FreeDictionaryAPIProvider
    mock_resolve = mocker.patch.object(FreeDictionaryAPIProvider, "resolve")
    mock_resolve.return_value = {
        "definition": "Mocked definition",
        "phonetics": "/m闊檏/",
        "api_example": "This is a mock.",
        "pos": "NOUN",
        "source": "MockProvider",
        "all_meanings": []
    }

    # 1. First lookup - should hit mock
    response = await client.get("/api/dictionary/testword")
    assert response.status_code == 200
    assert response.json()["definition"] == "Mocked definition"
    assert mock_resolve.call_count == 1

    # 2. Second lookup - should hit CACHE (DB) not mock
    response = await client.get("/api/dictionary/testword")
    assert response.status_code == 200
    assert response.json()["definition"] == "Mocked definition"
    assert mock_resolve.call_count == 1 # Still 1 because DB served it
