"""
Edge TTS router.
GET /api/tts?word=ephemeral&voice=en-US-AriaNeural
  → streams MP3 audio bytes

GET /api/tts/voices
  → returns list of English voices {name, gender, locale}

Audio is cached in data/audio/ so repeated requests are instant.
"""
import asyncio
from pathlib import Path
from fastapi import APIRouter, Query
from fastapi.responses import Response, JSONResponse, StreamingResponse

router = APIRouter(prefix="/api/tts")

_AUDIO_DIR = Path(__file__).parent.parent / "data" / "audio"
_DEFAULT_VOICE = "en-US-AriaNeural"

# Cached voice list to avoid repeated network calls
_voice_cache: list[dict] | None = None


def _cache_path(word: str, voice: str) -> Path:
    _AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    safe_word = "".join(c for c in word if c.isalnum() or c in " -_")[:50]
    safe_voice = voice.replace("-", "_")
    return _AUDIO_DIR / f"{safe_word}__{safe_voice}.mp3"


@router.get("/voices")
async def list_voices():
    """Return available English TTS voices from edge-tts."""
    global _voice_cache
    if _voice_cache is not None:
        return _voice_cache

    try:
        import edge_tts
        all_voices = await edge_tts.list_voices()
        english = [
            {
                "name": v["Name"],
                "locale": v["Locale"],
                "gender": v["Gender"],
                "display": f"{v['Locale']} – {v['ShortName']} ({v['Gender']})",
                "short_name": v["ShortName"],
            }
            for v in all_voices
            if v["Locale"].startswith("en-")
        ]
        # Sort: en-US first, then others alphabetically
        english.sort(key=lambda v: (0 if v["locale"].startswith("en-US") else 1, v["short_name"]))
        _voice_cache = english
        return english
    except Exception as e:
        return JSONResponse(status_code=503, content={"error": str(e)})


@router.get("")
async def speak(
    word: str = Query(..., min_length=1, max_length=200),
    voice: str = Query(default=_DEFAULT_VOICE),
):
    """
    Synthesize speech for a word/phrase using edge-tts.
    Streams MP3 audio bytes dynamically via StreamingResponse with zero disk caching.
    """
    try:
        import edge_tts

        async def audio_stream():
            communicate = edge_tts.Communicate(word, voice)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]

        return StreamingResponse(audio_stream(), media_type="audio/mpeg")

    except Exception as e:
        return Response(
            content=f"TTS error: {e}".encode(),
            status_code=503,
            media_type="text/plain",
        )
