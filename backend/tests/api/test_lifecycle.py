import pytest
import io
import schemas
from services.pipeline import run_book_pipeline
from sqlalchemy import select, func
from models import Book, BookVocab, BookChapter, BookEntity

@pytest.mark.asyncio
async def test_full_book_lifecycle(client, session):
    # --- Step 1: Injection (Upload) ---
    # We simulate the upload to get a job_id
    file_content = b"The quick brown fox jumps over the lazy dog. <CHAPTER 1> Sherlock Holmes is here."
    response = await client.post(
        "/api/upload",
        files={"file": ("test_story.txt", file_content, "text/plain")},
        data={"level": "B1", "native_language": "Chinese"}
    )
    assert response.status_code == 200
    job_id = response.json()["job_id"]
    assert job_id is not None

    # --- Step 2: Forge (Processing) ---
    # We call the pipeline directly to ensure sync completion for the test
    await run_book_pipeline(
        job_id=job_id,
        clean_text=file_content.decode(),
        filename="test_story.txt",
        user_level="B1",
        native_language="Chinese",
        llm_provider="none", # Skip LLM for speed
        api_key="",
        session=session
    )

    # --- Step 3: Discovery (Library List) ---
    response = await client.get("/api/library")
    assert response.status_code == 200
    books = response.json()
    assert any(b["title"] == "Test Story" for b in books)
    book_id = next(b["id"] for b in books if b["title"] == "Test Story")

    # --- Step 4: Deep Dive (Book Details) ---
    # HIGH RISK ROUTE: Validate with Pydantic model
    response = await client.get(f"/api/library/{book_id}")
    assert response.status_code == 200
    detail_data = response.json()
    
    # This will raise an error if the contract is broken
    validated_detail = schemas.BookDetailResponse.model_validate(detail_data)
    assert validated_detail.title == "Test Story"
    assert len(validated_detail.vocab) > 0
    # Verify entity extraction worked
    assert any(e.label == "Character" and "Holmes" in e.text for e in validated_detail.entities)

    # --- Step 5: The Scholar (Filtered Vocab) ---
    response = await client.get(f"/api/library/{book_id}/vocab?search=fox")
    assert response.status_code == 200
    vocab_data = response.json()
    validated_vocab = schemas.PaginatedVocabResponse.model_validate(vocab_data)
    assert any("fox" in item.lemma for item in validated_vocab.items)

    # --- Step 6: Global Intelligence (Master Ledger) ---
    response = await client.get("/api/user/master-ledger")
    assert response.status_code == 200
    ledger_data = response.json()
    validated_ledger = schemas.MasterLedgerResponse.model_validate(ledger_data)
    assert any(item.lemma == "quick" for item in validated_ledger.vocab)

    # --- Step 7: The Purge (Deletion) ---
    response = await client.delete(f"/api/library/{book_id}")
    assert response.status_code == 200
    
    # Verify DB is truly empty
    assert (await session.execute(select(func.count()).select_from(Book))).scalar() == 0
    assert (await session.execute(select(func.count()).select_from(BookVocab))).scalar() == 0
    assert (await session.execute(select(func.count()).select_from(BookChapter))).scalar() == 0
    assert (await session.execute(select(func.count()).select_from(BookEntity))).scalar() == 0
