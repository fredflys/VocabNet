from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.book_repository import BookRepository
from services.database import engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from models import BookVocab, UserVocab, BookContext

# Session factory for non-FastAPI contexts (like background jobs)
async_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def save_book(filename: str, result: dict, session: Optional[AsyncSession] = None) -> str:
    if session:
        repo = BookRepository(session)
        return await repo.save_book(filename, result)
    async with async_session_factory() as session:
        repo = BookRepository(session)
        return await repo.save_book(filename, result)

async def load_manifest() -> List[dict]:
    async with async_session_factory() as session:
        repo = BookRepository(session)
        books = await repo.get_all()
        return [b.model_dump() for b in books]

async def load_book(book_id: str) -> Optional[dict]:
    async with async_session_factory() as session:
        repo = BookRepository(session)
        book = await repo.get_by_id(book_id)
        if not book:
            return None
        
        res = book.model_dump()
        res["chapters"] = [c.model_dump() for c in book.chapters]
        
        enriched_vocab = []
        for v in book.vocab:
            d = v.model_dump()
            # Parse chapter list if it was stored as string
            try:
                import json
                d["chapters"] = json.loads(v.chapter_list) if v.chapter_list else []
            except (json.JSONDecodeError, TypeError, ValueError):
                d["chapters"] = []
                
            d["count"] = v.occurrence_count
            
            # Global status
            stmt = select(UserVocab.status).where(UserVocab.lemma == v.lemma)
            g_status = (await session.execute(stmt)).scalar_one_or_none()
            if g_status:
                d["status"] = g_status
                
            # Global count
            stmt_c = select(func.sum(BookVocab.occurrence_count)).where(BookVocab.lemma == v.lemma)
            d["global_count"] = (await session.execute(stmt_c)).scalar() or v.occurrence_count
            
            # Contexts
            stmt_ctx = select(BookContext.example_sentence).where(BookContext.book_id == book_id, BookContext.lemma == v.lemma.lower()).limit(10)
            d["examples"] = (await session.execute(stmt_ctx)).scalars().all()
            if d["examples"]:
                d["example"] = d["examples"][0]
                
            enriched_vocab.append(d)
            
        res["vocab"] = enriched_vocab
        return res

async def delete_book(book_id: str) -> bool:
    async with async_session_factory() as session:
        repo = BookRepository(session)
        return await repo.delete(book_id)
