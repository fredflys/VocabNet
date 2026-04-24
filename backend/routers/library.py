"""
Library router — CRUD for the local book shelf.
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from repositories.book_repository import BookRepository
from services.database import get_session
import schemas

router = APIRouter(prefix="/api/library", tags=["library"])

@router.get("", response_model=List[schemas.BookBase])
async def list_books(session: AsyncSession = Depends(get_session)):
    """Return all saved books (metadata only)."""
    repo = BookRepository(session)
    books = await repo.get_all()
    return [b.model_dump() for b in books]

@router.get("/{book_id}", response_model=schemas.BookDetailResponse)
async def get_book(book_id: str, session: AsyncSession = Depends(get_session)):
    """Return the full result payload for a single saved book using Phase 3 optimized fetching."""
    repo = BookRepository(session)
    
    if book_id == "master":
        from repositories.user_repository import UserRepository
        user_repo = UserRepository(session)
        items = await user_repo.get_master_ledger()
        return {
            "id": "master",
            "title": "Library Master Ledger",
            "filename": "master_ledger.bin",
            "added_date": "2026-01-01T00:00:00",
            "total_words": sum(item["global_count"] for item in items),
            "unique_lemmas": len(items),
            "idiom_count": sum(1 for item in items if item.get("is_idiom")),
            "chapters": [],
            "vocab": items,
            "entities": []
        }
        
    result = await repo.get_by_id_enriched(book_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Book not found in library.")
    return result

@router.delete("/{book_id}")
async def remove_book(book_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a book from the library."""
    repo = BookRepository(session)
    ok = await repo.delete(book_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Book not found.")
    return {"deleted": book_id}

@router.get("/{book_id}/vocab", response_model=schemas.PaginatedVocabResponse)
async def get_book_vocab(
    book_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1),
    search: str = Query(""),
    cefr: str = Query(""),
    vocab_type: str = Query("", alias="type"),
    chapter: Optional[int] = Query(None),
    session: AsyncSession = Depends(get_session)
):
    """Paginated, searchable vocab for a book."""
    repo = BookRepository(session)
    items, total_count = await repo.get_vocab_paginated(book_id, page, page_size, search, cefr, vocab_type, chapter)
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size
    }
