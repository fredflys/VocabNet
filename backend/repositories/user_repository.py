from typing import List, Dict, Optional, Any
from sqlalchemy import select, func
from models import UserVocab, UserSession, UserStat, BookVocab, DictCache, UserProfile
from repositories.base import BaseRepository
from datetime import datetime, timedelta
from services.filter import _CEFR_ORDER

class UserRepository(BaseRepository):
    async def get_all_vocab(self) -> Dict[str, dict]:
        stmt = select(UserVocab)
        result = await self.session.execute(stmt)
        return {row.lemma: row.model_dump() for row in result.scalars().all()}

    async def update_vocab(self, data: Dict[str, dict]):
        for lemma, state in data.items():
            user_vocab = UserVocab(
                lemma=lemma,
                status=state.get("status", "learning"),
                reps=state.get("reps", 0),
                ease=state.get("ease", 2.5),
                interval_days=state.get("interval_days", 0.0),
                next_review_date=state.get("next_review_date"),
                last_reviewed=state.get("last_reviewed"),
                mastery_source=state.get("mastery_source", "study")
            )
            await self.session.merge(user_vocab)
        await self.session.commit()

    async def get_stats(self) -> dict:
        stmt_stats = select(UserStat).limit(1)
        stat_row = (await self.session.execute(stmt_stats)).scalar_one_or_none()
        
        stmt_sessions = select(UserSession).order_by(UserSession.date.desc()).limit(30)
        sessions = (await self.session.execute(stmt_sessions)).scalars().all()
        
        stats = stat_row.model_dump() if stat_row else {"streak_count": 0, "last_study_date": None}
        return {
            "stats": stats,
            "sessions": [s.model_dump() for s in sessions]
        }

    async def record_session(self, mode: str, reviewed: int, correct: int):
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Add session
        session = UserSession(
            date=datetime.now().isoformat(),
            mode=mode,
            words_reviewed=reviewed,
            words_correct=correct
        )
        self.session.add(session)
        
        # Update stats
        stmt = select(UserStat).limit(1)
        stats = (await self.session.execute(stmt)).scalar_one_or_none()
        
        if not stats:
            stats = UserStat(streak_count=1, last_study_date=today)
            self.session.add(stats)
        else:
            if stats.last_study_date != today:
                yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
                if stats.last_study_date == yesterday:
                    stats.streak_count += 1
                else:
                    stats.streak_count = 1
                stats.last_study_date = today
        
        await self.session.commit()

    async def get_profile(self) -> dict:
        stmt = select(UserProfile).where(UserProfile.id == 1)
        row = (await self.session.execute(stmt)).scalar_one_or_none()
        if row:
            return row.model_dump()
        return {"id": 1, "cefr_level": "B1", "updated_at": ""}

    async def update_profile(self, cefr_level: str) -> dict:
        now = datetime.now().isoformat()
        profile = UserProfile(id=1, cefr_level=cefr_level, updated_at=now)
        await self.session.merge(profile)
        await self.session.commit()
        return {"cefr_level": cefr_level, "updated_at": now}

    async def auto_master_words(self, cefr_level: str) -> int:
        """Batch-create UserVocab entries with mastery_source='auto' for all
        BookVocab lemmas at or below the user's CEFR level. Does NOT overwrite
        entries with mastery_source='study' or 'manual'."""
        user_idx = _CEFR_ORDER.index(cefr_level) if cefr_level in _CEFR_ORDER else 2
        eligible_levels = _CEFR_ORDER[:user_idx + 1]  # e.g. B1 -> [A1, A2, B1]

        # Get all unique lemmas from BookVocab at eligible levels
        stmt = select(BookVocab.lemma).where(
            BookVocab.cefr.in_(eligible_levels)
        ).group_by(BookVocab.lemma)
        result = await self.session.execute(stmt)
        candidate_lemmas = {row.lemma for row in result.all()}

        if not candidate_lemmas:
            return 0

        # Get existing user vocab entries that should NOT be overwritten
        stmt_existing = select(UserVocab.lemma, UserVocab.mastery_source).where(
            UserVocab.lemma.in_(candidate_lemmas)
        )
        existing = await self.session.execute(stmt_existing)
        existing_map = {row.lemma: row.mastery_source for row in existing.all()}

        count = 0
        for lemma in candidate_lemmas:
            existing_source = existing_map.get(lemma)
            # Skip if already has study or manual mastery
            if existing_source in ("study", "manual"):
                continue
            # Create or update with auto mastery
            user_vocab = UserVocab(
                lemma=lemma,
                status="mastered",
                reps=0,
                ease=2.5,
                interval_days=0.0,
                next_review_date=None,
                last_reviewed=None,
                mastery_source="auto"
            )
            await self.session.merge(user_vocab)
            count += 1

        await self.session.commit()
        return count

    async def get_master_ledger(self) -> List[dict]:
        # Using the optimized query from the plan
        stmt = select(
            BookVocab.lemma,
            BookVocab.pos,
            BookVocab.cefr,
            BookVocab.is_idiom,
            UserVocab.status,
            UserVocab.reps,
            UserVocab.ease,
            UserVocab.interval_days,
            UserVocab.last_reviewed,
            DictCache.definition,
            DictCache.phonetics,
            DictCache.api_example,
            func.sum(BookVocab.occurrence_count).label("global_count")
        ).outerjoin(
            UserVocab, BookVocab.lemma == UserVocab.lemma
        ).outerjoin(
            DictCache, BookVocab.lemma == DictCache.lemma
        ).group_by(BookVocab.lemma).order_by(func.sum(BookVocab.occurrence_count).desc())
        
        result = await self.session.execute(stmt)
        
        items = []
        for row in result.all():
            items.append({
                "lemma": row.lemma,
                "book_id": "master",
                "status": row.status or "new",
                "reps": row.reps or 0,
                "definition": row.definition or "",
                "pos": row.pos or "",
                "phonetics": row.phonetics or "",
                "example": row.api_example or "",
                "count": row.global_count or 0,
                "global_count": row.global_count or 0,
                "cefr": row.cefr or "?",
                "is_idiom": bool(row.is_idiom)
            })
        return items

    async def get_distractors(self, pos: str, exclude: str, count: int) -> List[dict]:
        # Find words with same POS
        stmt = select(DictCache.lemma, DictCache.definition).where(
            DictCache.pos == pos,
            DictCache.lemma != exclude.lower(),
            DictCache.definition != ""
        ).order_by(func.random()).limit(count)
        
        rows = (await self.session.execute(stmt)).all()
        
        if len(rows) < count:
            # Fallback
            stmt = select(DictCache.lemma, DictCache.definition).where(
                DictCache.lemma != exclude.lower(),
                DictCache.definition != ""
            ).order_by(func.random()).limit(count)
            rows = (await self.session.execute(stmt)).all()
            
        return [{"lemma": r.lemma, "definition": r.definition} for r in rows]
