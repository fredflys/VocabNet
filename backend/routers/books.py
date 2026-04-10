"""
API router for book upload and job status endpoints.
"""
import asyncio
import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from jobs.store import create_job, get_job, update_job
from services.parser import extract_text, extract_epub
from services.pipeline import run_book_pipeline
from repositories.book_repository import BookRepository
from services.database import get_session

router = APIRouter(prefix="/api", tags=["books"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {".txt", ".epub"}


@router.post("/upload")
async def upload_book(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    level: str = Form("B1"),
    native_language: str = Form("Chinese"),
    llm_provider: str = Form("gemini"),
    api_key: str = Form(""),
):
    """Accept a .txt or .epub file, start background processing, return a job ID."""
    import html

    # Sanitization
    level = html.escape(level.strip()[:10])
    native_language = html.escape(native_language.strip()[:50])
    llm_provider = ''.join(c for c in llm_provider if c.isalnum() or c == '-')[:20]
    api_key = api_key.strip()
    
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .txt and .epub files are supported.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB).")

    if ext == ".epub":
        try:
            clean_text, title, author = extract_epub(content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse EPUB: {e}")
    else:
        try:
            raw_text = content.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = content.decode("latin-1")
        clean_text = extract_text(raw_text)
        title = file.filename
        author = ""

    job_id = create_job()
    background_tasks.add_task(
        run_book_pipeline,
        job_id,
        clean_text,
        file.filename,
        level,
        native_language,
        llm_provider,
        api_key,
    )

    return {"job_id": job_id}


@router.get("/job/{job_id}")
async def get_job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {
        "status": job.status,
        "progress": job.progress,
        "error": job.error,
        "result": job.result,
    }

@router.get("/job/stream/{job_id}")
async def stream_job_status(request: Request, job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    async def event_generator():
        last_progress = -1
        last_status = None
        while True:
            if await request.is_disconnected():
                break
            current_job = get_job(job_id)
            if not current_job:
                break
            if current_job.progress != last_progress or current_job.status != last_status:
                last_progress = current_job.progress
                last_status = current_job.status
                yield {
                    "event": "message",
                    "data": json.dumps({
                        "status": current_job.status,
                        "progress": current_job.progress,
                        "error": current_job.error,
                        "result_ready": bool(current_job.result)
                    })
                }
                if current_job.status in ["done", "error"]:
                    break
            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@router.get("/contexts/{word}")
async def get_cross_book_contexts(word: str, session: AsyncSession = Depends(get_session)):
    """Scan all library books and return up to 10 contextual sentences per book for the given word."""
    repo = BookRepository(session)
    results = await repo.get_contexts_for_word(word)
    return {"word": word, "results": results}
