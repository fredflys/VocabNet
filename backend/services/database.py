from sqlmodel import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from pathlib import Path

# Provide standard models to ensure they are registered with SQLModel
from models import *

DATABASE_PATH = Path(__file__).parent.parent / "data" / "audiobook.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_PATH}"

# Async engine for use with SQLModel/SQLAlchemy
engine = create_async_engine(DATABASE_URL, echo=False)

# Module-level session factory (created once, not per-request)
async_session_factory = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# ORM Session provider for FastAPI Dependency Injection
async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
