from typing import Optional
from sqlalchemy import select
from models import DictCache
from repositories.base import BaseRepository
from datetime import datetime
import json

class DictRepository(BaseRepository):
    async def get_by_lemma(self, lemma: str) -> Optional[dict]:
        stmt = select(DictCache).where(DictCache.lemma == lemma.lower().strip())
        row = (await self.session.execute(stmt)).scalar_one_or_none()
        if row:
            d = row.model_dump()
            d["all_meanings"] = json.loads(row.all_meanings) if row.all_meanings else []
            d["inflections"] = json.loads(row.inflections) if row.inflections else []
            return d
        return None

    async def upsert(self, lemma: str, data: dict):
        cache_entry = DictCache(
            lemma=lemma.lower().strip(),
            definition=data.get('definition', ''),
            phonetics=data.get('phonetics', ''),
            api_example=data.get('api_example', ''),
            pos=data.get('pos', ''),
            source=data.get('source', ''),
            all_meanings=json.dumps(data.get('all_meanings', [])),
            inflections=json.dumps(data.get('inflections', [])),
            updated_at=datetime.now().isoformat()
        )
        await self.session.merge(cache_entry)
        await self.session.commit()
