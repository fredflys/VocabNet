"""
Known words management (Legacy bridge).
"""
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from models import KnownWord
from services.database import get_session

router = APIRouter(prefix="/api/known-words", tags=["known-words"])

@router.get("")
async def list_known_words(session: AsyncSession = Depends(get_session)):
    stmt = select(KnownWord)
    result = await session.execute(stmt)
    return [{"lemma": r.lemma} for r in result.scalars().all()]

@router.post("")
async def add_known_word(data: dict = Body(...), session: AsyncSession = Depends(get_session)):
    lemma = data.get("lemma", "").lower().strip()
    if not lemma:
        raise HTTPException(status_code=400, detail="Lemma required")

    known = KnownWord(lemma=lemma)
    await session.merge(known)
    await session.commit()
    return {"status": "added", "lemma": lemma}

@router.delete("")
async def remove_known_word(data: dict = Body(...), session: AsyncSession = Depends(get_session)):
    lemma = data.get("lemma", "").lower().strip()
    if not lemma:
        raise HTTPException(status_code=400, detail="Lemma required")

    stmt = delete(KnownWord).where(KnownWord.lemma == lemma)
    await session.execute(stmt)
    await session.commit()
    return {"status": "removed", "lemma": lemma}
