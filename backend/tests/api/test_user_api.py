import pytest
from models import UserVocab, UserStat
from sqlalchemy import select

@pytest.mark.asyncio
async def test_vocab_update_and_persistence(client, session):
    # Update state for 'ephemeral'
    update_data = {
        "ephemeral": {
            "status": "review",
            "reps": 3,
            "ease": 2.4,
            "interval_days": 15.0,
            "next_review_date": "2026-04-20",
            "last_reviewed": "2026-04-05"
        }
    }
    response = await client.post("/api/user/vocab", json=update_data)
    assert response.status_code == 200
    
    # Fetch back and verify
    response = await client.get("/api/user/vocab")
    data = response.json()
    assert "ephemeral" in data
    assert data["ephemeral"]["reps"] == 3
    assert data["ephemeral"]["status"] == "review"

@pytest.mark.asyncio
async def test_session_recording_and_streak(client, session):
    # Record a session
    session_data = {
        "mode": "Flashcards",
        "wordsReviewed": 20,
        "wordsCorrect": 18
    }
    response = await client.post("/api/user/session", json=session_data)
    assert response.status_code == 200
    
    # Check stats
    response = await client.get("/api/user/stats")
    data = response.json()
    assert data["stats"]["streak_count"] >= 1
    assert len(data["sessions"]) == 1
    assert data["sessions"][0]["words_correct"] == 18
