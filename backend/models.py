from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
import json

# ── Book Models ──────────────────────────────────────────────────────────────

class Book(SQLModel, table=True):
    __tablename__ = "books"
    id: str = Field(primary_key=True)
    title: str
    filename: str
    added_date: str
    total_words: int = Field(default=0)
    unique_lemmas: int = Field(default=0)
    difficult_count: int = Field(default=0)
    idiom_count: int = Field(default=0)
    total_chapters: int = Field(default=0)

    # Relationships
    chapters: List["BookChapter"] = Relationship(back_populates="book", cascade_delete=True)
    vocab: List["BookVocab"] = Relationship(back_populates="book", cascade_delete=True)
    contexts: List["BookContext"] = Relationship(back_populates="book", cascade_delete=True)
    entities: List["BookEntity"] = Relationship(back_populates="book", cascade_delete=True)

class BookChapter(SQLModel, table=True):
    __tablename__ = "book_chapters"
    id: Optional[int] = Field(default=None, primary_key=True)
    book_id: str = Field(foreign_key="books.id", index=True, ondelete="CASCADE")
    chapter_number: int
    word_count: int

    book: Optional[Book] = Relationship(back_populates="chapters")

class BookVocab(SQLModel, table=True):
    __tablename__ = "book_vocab"
    id: Optional[int] = Field(default=None, primary_key=True)
    book_id: str = Field(foreign_key="books.id", index=True, ondelete="CASCADE")
    lemma: str
    pos: str
    occurrence_count: int = Field(default=1)
    first_chapter: int = Field(default=0)
    chapter_list: str = Field(default="[]")
    is_idiom: bool = Field(default=False)
    idiom_type: str = Field(default="")
    simple_def: str = Field(default="")
    memory_tip: str = Field(default="")
    llm_example: str = Field(default="")
    translation: str = Field(default="")
    has_llm: bool = Field(default=False)
    status: str = Field(default="learning")
    cefr: str = Field(default="?")

    book: Optional[Book] = Relationship(back_populates="vocab")

class BookContext(SQLModel, table=True):
    __tablename__ = "book_contexts"
    id: Optional[int] = Field(default=None, primary_key=True)
    book_id: str = Field(foreign_key="books.id", index=True, ondelete="CASCADE")
    lemma: str = Field(index=True)
    example_sentence: str

    book: Optional[Book] = Relationship(back_populates="contexts")

class BookEntity(SQLModel, table=True):
    __tablename__ = "book_entities"
    id: Optional[int] = Field(default=None, primary_key=True)
    book_id: str = Field(foreign_key="books.id", index=True, ondelete="CASCADE")
    text: str
    label: str # Character, Location, Organization, Concept
    occurrence_count: int = Field(default=1)
    first_chapter: int = Field(default=0)
    relationships: str = Field(default="[]") # JSON list of {target: str, weight: int}

    book: Optional[Book] = Relationship(back_populates="entities")

# ── Dictionary Models ────────────────────────────────────────────────────────

class DictCache(SQLModel, table=True):
    __tablename__ = "dict_cache"
    lemma: str = Field(primary_key=True)
    definition: str = Field(default="")
    phonetics: str = Field(default="")
    api_example: str = Field(default="")
    pos: str = Field(default="")
    source: str = Field(default="")
    all_meanings: str = Field(default="[]")
    updated_at: str

# ── Global User Data Models ──────────────────────────────────────────────────

class KnownWord(SQLModel, table=True):
    __tablename__ = "known_words"
    lemma: str = Field(primary_key=True)

class UserVocab(SQLModel, table=True):
    __tablename__ = "user_vocab"
    lemma: str = Field(primary_key=True)
    status: str = Field(default="learning")
    reps: int = Field(default=0)
    ease: float = Field(default=2.5)
    interval_days: float = Field(default=0.0)
    next_review_date: Optional[str] = Field(default=None)
    last_reviewed: Optional[str] = Field(default=None)

class UserSession(SQLModel, table=True):
    __tablename__ = "user_sessions"
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str
    mode: str
    words_reviewed: int
    words_correct: int

class UserStat(SQLModel, table=True):
    __tablename__ = "user_stats"
    id: Optional[int] = Field(default=None, primary_key=True)
    streak_count: int = Field(default=0)
    last_study_date: Optional[str] = Field(default=None)
