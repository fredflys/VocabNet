from pydantic import BaseModel, Field, RootModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# ── Base Models ──────────────────────────────────────────────────────────────

class BookBase(BaseModel):
    id: str
    title: str
    total_words: int
    unique_lemmas: int
    difficult_count: int = 0
    idiom_count: int
    total_chapters: int = 0
    added_date: str

class VocabEntry(BaseModel):
    lemma: str
    pos: str
    occurrence_count: int = Field(alias="count")
    cefr: str
    status: str
    first_chapter: int = 0
    chapters: List[int] = []
    translation: Optional[str] = ""
    simple_def: Optional[str] = ""
    memory_tip: Optional[str] = ""
    example: Optional[str] = ""
    examples: List[str] = []
    global_count: int = 0
    is_idiom: bool = False
    
    class Config:
        populate_by_name = True

class EntityRelationship(BaseModel):
    target: str
    weight: int
    scenes: Optional[List[str]] = []

class BookEntityBase(BaseModel):
    text: str
    label: str
    occurrence_count: int = Field(alias="count")
    first_chapter: int = 0
    relationships: List[EntityRelationship] = []
    
    class Config:
        populate_by_name = True

# ── Response Models ──────────────────────────────────────────────────────────

class BookListResponse(BaseModel):
    books: List[BookBase]

class ChapterInfo(BaseModel):
    number: int
    word_count: int

class BookDetailResponse(BookBase):
    chapters: List[ChapterInfo]
    vocab: List[VocabEntry]
    entities: List[BookEntityBase] = []

class PaginatedVocabResponse(BaseModel):
    items: List[VocabEntry]
    total: int
    page: int
    page_size: int
    total_pages: int

class MasterLedgerResponse(BaseModel):
    title: str
    vocab: List[VocabEntry]

class UserStats(BaseModel):
    streak_count: int
    last_study_date: Optional[str]

class UserSessionInfo(BaseModel):
    date: str
    mode: str
    words_reviewed: int
    words_correct: int

class UserStatsResponse(BaseModel):
    stats: UserStats
    sessions: List[UserSessionInfo]

class Distractor(BaseModel):
    lemma: str
    definition: str

# ── Request Models ───────────────────────────────────────────────────────────

class VocabUpdate(BaseModel):
    status: str
    reps: int
    ease: float
    interval_days: float
    next_review_date: Optional[str]
    last_reviewed: Optional[str]

class UserVocabUpdateReq(RootModel):
    root: Dict[str, VocabUpdate]

class SessionRecordReq(BaseModel):
    mode: str
    wordsReviewed: int
    wordsCorrect: int
