"""
In-memory job store for background processing.
"""
import uuid
from typing import Any
from dataclasses import dataclass, field


@dataclass
class Job:
    id: str
    status: str = "pending"   # pending | processing | done | error
    progress: int = 0
    error: str | None = None
    result: Any = None


# Module-level store — lives for the lifetime of the server process
_jobs: dict[str, Job] = {}


def create_job() -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = Job(id=job_id)
    return job_id


def get_job(job_id: str) -> Job | None:
    return _jobs.get(job_id)


def update_job(job_id: str, **kwargs):
    job = _jobs.get(job_id)
    if job:
        for k, v in kwargs.items():
            setattr(job, k, v)
