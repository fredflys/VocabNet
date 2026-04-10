"""
Dictionary router — on-demand single-word lookup.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from services.dictionary import get_definition
from services.database import get_session

router = APIRouter(prefix="/api/dictionary", tags=["dictionary"])

@router.get("/{word}")
async def define_word(word: str, session: AsyncSession = Depends(get_session)):
    """
    Look up a single word.
    Tries each provider tier in order; returns cached result if available.
    """
    result = await get_definition(word.strip().lower(), session)
    return result
