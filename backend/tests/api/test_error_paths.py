import pytest


@pytest.mark.asyncio
async def test_upload_invalid_file_type(client):
    """Uploading a non-txt/epub file should return 400."""
    response = await client.post(
        "/api/upload",
        files={"file": ("test.pdf", b"fake pdf content", "application/pdf")},
        data={"level": "B1", "native_language": "Chinese"},
    )
    assert response.status_code == 400
    assert "supported" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_oversized_file(client):
    """Uploading a file exceeding 50MB should return 413."""
    # Create content just over the limit
    large_content = b"x" * (50 * 1024 * 1024 + 1)
    response = await client.post(
        "/api/upload",
        files={"file": ("big.txt", large_content, "text/plain")},
        data={"level": "B1", "native_language": "Chinese"},
    )
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_book_not_found(client):
    """Requesting a nonexistent book should return 404."""
    response = await client.get("/api/library/nonexistent-id")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_gutenberg_search_empty_query(client):
    """Searching with an empty query should return 400."""
    response = await client.get("/api/gutenberg/search", params={"query": ""})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_gutenberg_search_whitespace_query(client):
    """Searching with whitespace-only query should return 400."""
    response = await client.get("/api/gutenberg/search", params={"query": "   "})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_known_words_add_empty_lemma(client):
    """Adding a known word with empty lemma should return 400."""
    response = await client.post(
        "/api/known-words",
        json={"lemma": ""},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_known_words_delete_empty_lemma(client):
    """Deleting a known word with empty lemma should return 400."""
    response = await client.request(
        "DELETE",
        "/api/known-words",
        json={"lemma": ""},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_delete_nonexistent_book(client):
    """Deleting a book that doesn't exist should return 404."""
    response = await client.delete("/api/library/does-not-exist")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_job_not_found(client):
    """Getting a nonexistent job should return 404."""
    response = await client.get("/api/job/nonexistent-job-id")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_dictionary_lookup_nonexistent_word(client, mocker):
    """Dictionary lookup for a gibberish word should return empty definition."""
    from services.dictionary import (
        WiktionaryProvider, CambridgeDictionaryProvider,
        FreeDictionaryAPIProvider, DictionaryAPIDevProvider,
    )
    mocker.patch.object(WiktionaryProvider, "resolve", return_value=None)
    mocker.patch.object(CambridgeDictionaryProvider, "resolve", return_value=None)
    mocker.patch.object(FreeDictionaryAPIProvider, "resolve", return_value=None)
    mocker.patch.object(DictionaryAPIDevProvider, "resolve", return_value=None)

    response = await client.get("/api/dictionary/xyzzyplugh")
    assert response.status_code == 200
    data = response.json()
    assert data["definition"] == ""
