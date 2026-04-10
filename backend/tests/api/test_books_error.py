import pytest
import json
from models import Book, BookVocab, BookEntity

@pytest.mark.asyncio
async def test_get_book_details_error(client, session):
    # 1. Create a dummy book
    book = Book(
        id="test-id",
        title="Test Book",
        filename="test.epub",
        added_date="2026-04-08",
        total_words=100,
        unique_lemmas=10,
        difficult_count=5,
        idiom_count=2,
        total_chapters=1
    )
    session.add(book)
    
    # 2. Add many vocab entries
    for i in range(100):
        vocab = BookVocab(
            book_id="test-id",
            lemma=f"word{i}",
            pos="NOUN",
            occurrence_count=1,
            cefr="A1",
            status="learning"
        )
        session.add(vocab)
    
    # 3. Add Entity with relationships (including scenes)
    entity = BookEntity(
        book_id="test-id",
        text="Sherlock",
        label="Character",
        occurrence_count=10,
        first_chapter=1,
        relationships=json.dumps([
            {
                "target": "Watson",
                "weight": 5,
                "scenes": ["They met in the lab.", "Watson followed him."]
            }
        ])
    )
    session.add(entity)
    await session.commit()
    
    # 4. Try to fetch it
    response = await client.get("/api/library/test-id")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "test-id"
    assert len(data["entities"]) == 1
    assert "scenes" in data["entities"][0]["relationships"][0]
