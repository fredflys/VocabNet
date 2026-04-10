"""
Project Gutenberg integration via the free Gutendex API.
Search for public domain books and fetch their text.
"""
import httpx
import re
from fastapi import APIRouter, Form, HTTPException, BackgroundTasks

from jobs.store import create_job, update_job

router = APIRouter(prefix="/api/gutenberg")

GUTENDEX_URL = "https://gutendex.com/books/"
GUTENBERG_TXT = "https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt"

# Simple in-memory cache for fetched texts
_text_cache: dict[int, str] = {}


@router.get("/search")
async def search_gutenberg(query: str):
    """Search Project Gutenberg via Gutendex API."""
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query is required.")

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(
                GUTENDEX_URL,
                params={"search": query, "languages": "en"},
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Gutenberg search failed: {e}")

    results = []
    for book in data.get("results", [])[:8]:
        authors = book.get("authors", [])
        author_name = authors[0]["name"] if authors else "Unknown"
        results.append({
            "id": book["id"],
            "title": book.get("title", "Untitled"),
            "author": author_name,
            "download_count": book.get("download_count", 0),
        })

    return {"results": results}


@router.post("/fetch")
async def fetch_gutenberg(
    background_tasks: BackgroundTasks,
    gutenberg_id: int = Form(...),
    title: str = Form(""),
    level: str = Form("B1"),
    native_language: str = Form("Chinese"),
    llm_provider: str = Form("gemini"),
    api_key: str = Form(""),
):
    """Fetch a Gutenberg book by ID and start processing."""
    from services.parser import extract_text
    from routers.books import process_book

    # Check cache first
    if gutenberg_id in _text_cache:
        clean_text = _text_cache[gutenberg_id]
    else:
        # Download the plain text
        url = GUTENBERG_TXT.format(id=gutenberg_id)
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                raw_text = resp.text
            except Exception as e:
                # Try alternate URL pattern
                alt_url = f"https://www.gutenberg.org/files/{gutenberg_id}/{gutenberg_id}-0.txt"
                try:
                    resp = await client.get(alt_url)
                    resp.raise_for_status()
                    raw_text = resp.text
                except Exception:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Could not download book {gutenberg_id}: {e}",
                    )

        clean_text = extract_text(raw_text)
        _text_cache[gutenberg_id] = clean_text

    filename = f"{title or f'gutenberg_{gutenberg_id}'}.txt"
    job_id = create_job()
    background_tasks.add_task(
        process_book,
        job_id,
        clean_text,
        filename,
        level,
        native_language,
        llm_provider,
        api_key,
    )

    return {"job_id": job_id}
