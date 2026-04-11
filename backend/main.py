"""
FastAPI application entry point.
"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.books import router as books_router
from routers.gutenberg import router as gutenberg_router
from routers.library import router as library_router
from routers.tts import router as tts_router
from routers.dictionary import router as dictionary_router
from routers.known_words import router as known_words_router
from routers.user import router as user_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize Database
    print("Checking database integrity...")
    from services.database import engine, DATABASE_PATH
    import models
    from sqlmodel import SQLModel
    
    # Ensure data directory exists
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    print("Database ready.")

    # 2. Pre-load NLP Models
    print("Pre-loading and verifying NLP pipeline...")
    from services.pipeline import verify_pipeline_health
    is_healthy = await asyncio.to_thread(verify_pipeline_health)
    if not is_healthy:
        print("❌ FATAL: NLP pipeline failed to initialize. Check models and dependencies.")
        # We don't exit hard here to let FastAPI finish starting so we can see the error,
        # but in a real prod env we might sys.exit(1). Let's raise an exception.
        raise RuntimeError("NLP Pipeline initialization failed.")
    print("NLP models active and verified.")
    
    yield
    print("Shutting down API...")

app = FastAPI(title="VocabNet API", version="1.0.0", lifespan=lifespan)

# Allow requests from the Vite dev server (port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(books_router)
app.include_router(gutenberg_router)
app.include_router(library_router)
app.include_router(tts_router)
app.include_router(dictionary_router)
app.include_router(known_words_router)
app.include_router(user_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
