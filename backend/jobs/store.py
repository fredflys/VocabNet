"""
In-memory job store for background processing.
"""
import uuid
import time
from typing import Any
from dataclasses import dataclass, field


# Jobs older than this (in seconds) after completion are auto-removed
_JOB_TTL_SECONDS = 3600  # 1 hour


@dataclass
class Job:
    id: str
    status: str = "pending"   # pending | processing | done | error
    progress: int = 0
    error: str | None = None
    result: Any = None
    created_at: float = field(default_factory=time.monotonic)
    finished_at: float | None = None


# Module-level store — lives for the lifetime of the server process
_jobs: dict[str, Job] = {}


def _cleanup_expired() -> None:
    """Remove jobs that have been in a terminal state for longer than TTL."""
    now = time.monotonic()
    expired = [
        jid for jid, job in _jobs.items()
        if job.finished_at is not None
        and (now - job.finished_at) > _JOB_TTL_SECONDS
    ]
    for jid in expired:
        del _jobs[jid]


def create_job() -> str:
    _cleanup_expired()
    job_id = str(uuid.uuid4())
    _jobs[job_id] = Job(id=job_id)
    return job_id


def get_job(job_id: str) -> Job | None:
    _cleanup_expired()
    return _jobs.get(job_id)


def update_job(job_id: str, **kwargs):
    job = _jobs.get(job_id)
    if job:
        for k, v in kwargs.items():
            setattr(job, k, v)
        if job.status in ("done", "error") and job.finished_at is None:
            job.finished_at = time.monotonic()
