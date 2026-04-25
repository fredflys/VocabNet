"""
User progress persistence API.
"""
from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List

from repositories.user_repository import UserRepository
from services.database import get_session
import schemas

router = APIRouter(prefix="/api/user", tags=["user"])

@router.get("/profile", response_model=schemas.UserProfileResponse)
async def get_profile(session: AsyncSession = Depends(get_session)):
    """Get the user's CEFR profile."""
    repo = UserRepository(session)
    return await repo.get_profile()

@router.put("/profile")
async def update_profile(data: schemas.UserProfileUpdateReq = Body(...), session: AsyncSession = Depends(get_session)):
    """Update the user's CEFR level and trigger auto-mastery."""
    repo = UserRepository(session)
    result = await repo.update_profile(data.cefr_level)
    auto_count = await repo.auto_master_words(data.cefr_level)
    return {**result, "auto_mastered_count": auto_count}

@router.post("/auto-master")
async def auto_master(session: AsyncSession = Depends(get_session)):
    """Manually trigger auto-mastery based on saved profile level."""
    repo = UserRepository(session)
    profile = await repo.get_profile()
    count = await repo.auto_master_words(profile["cefr_level"])
    return {"auto_mastered_count": count}

@router.get("/vocab", response_model=Dict[str, schemas.VocabUpdate])
async def get_user_vocab(session: AsyncSession = Depends(get_session)):
    """Fetch all global SM-2 states for the user."""
    repo = UserRepository(session)
    return await repo.get_all_vocab()

@router.post("/vocab")
async def update_user_vocab(data: Dict[str, schemas.VocabUpdate] = Body(...), session: AsyncSession = Depends(get_session)):
    """Update SM-2 states for multiple words or a single word."""
    repo = UserRepository(session)
    # Convert schema models back to dict for repository processing
    data_dict = {k: v.model_dump() for k, v in data.items()}
    await repo.update_vocab(data_dict)
    return {"status": "success"}

@router.get("/master-ledger", response_model=schemas.MasterLedgerResponse)
async def get_master_ledger(session: AsyncSession = Depends(get_session)):
    """Fetch the master vocabulary ledger combining ALL unique words from library."""
    repo = UserRepository(session)
    items = await repo.get_master_ledger()
    return {"title": "Library Master Ledger", "vocab": items}

@router.get("/stats", response_model=schemas.UserStatsResponse)
async def get_user_stats(session: AsyncSession = Depends(get_session)):
    """Get streak and last sessions."""
    repo = UserRepository(session)
    return await repo.get_stats()

@router.post("/session")
async def record_session(data: schemas.SessionRecordReq = Body(...), session: AsyncSession = Depends(get_session)):
    """Record a study session and update streak."""
    repo = UserRepository(session)
    await repo.record_session(
        mode=data.mode,
        reviewed=data.wordsReviewed,
        correct=data.wordsCorrect
    )
    return {"status": "success"}

@router.get("/distractors", response_model=List[schemas.Distractor])
async def get_distractors(
    pos: str = "NOUN", 
    exclude: str = "", 
    count: int = 3,
    session: AsyncSession = Depends(get_session)
):
    """Fetch random distractors from the global dictionary cache with same POS."""
    repo = UserRepository(session)
    return await repo.get_distractors(pos, exclude, count)
