"""
LLM provider abstraction for generating contextual word explanations.
Supports Google Gemini (primary) and OpenAI (fallback).
"""
import json
import logging
import asyncio
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

# ── Prompt template ──────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an English vocabulary tutor helping a non-native speaker.
For each word below, provide:
1. simple_def — A clear one-sentence definition using simple English
2. memory_tip — A short mnemonic or association to help remember the word
3. example — A simple example sentence (NOT from the book)
4. translation — The word translated into {native_language}

Respond ONLY with a valid JSON array. No markdown, no explanation. Example:
[{{"word":"ephemeral","simple_def":"lasting only a very short time","memory_tip":"Think of 'ephemera' — old tickets kept briefly then thrown away","example":"Social media fame is often ephemeral.","translation":"短暂的"}}]"""


def _build_user_prompt(words: list[dict]) -> str:
    """Build the user prompt listing words with their book context."""
    lines = []
    for i, w in enumerate(words, 1):
        sentence = w.get("example", "")[:200]
        lines.append(f'{i}. {w["lemma"]} — "{sentence}"')
    return "\n".join(lines)


def _parse_llm_response(raw: str) -> list[dict]:
    """Parse the LLM response JSON, handling common formatting issues."""
    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM response as JSON")
        return []


# ── Provider interface ───────────────────────────────────────────────────────

class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Send a prompt and return the raw text response."""
        ...


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        from google import genai

        client = genai.Client(api_key=self.api_key)
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model="gemini-2.0-flash",
                contents=f"{system_prompt}\n\n{user_prompt}",
            ),
        )
        return response.text


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
        )
        return response.choices[0].message.content


def get_provider(provider_name: str, api_key: str) -> LLMProvider:
    if provider_name == "openai":
        return OpenAIProvider(api_key)
    return GeminiProvider(api_key)


# ── Batch explanation function ───────────────────────────────────────────────

BATCH_SIZE = 40  # words per LLM call


async def generate_explanations(
    vocab: list[dict],
    native_language: str,
    provider_name: str,
    api_key: str,
    max_words: int = 200,
    progress_callback=None,
) -> dict[str, dict]:
    """
    Generate LLM explanations for vocabulary words in batches.
    Returns {lemma: {simple_def, memory_tip, example, translation}}.
    """
    if not api_key:
        return {}

    provider = get_provider(provider_name, api_key)
    system = _SYSTEM_PROMPT.replace("{native_language}", native_language)

    words_to_process = vocab[:max_words]
    results: dict[str, dict] = {}

    # Process in batches
    batches = [
        words_to_process[i : i + BATCH_SIZE]
        for i in range(0, len(words_to_process), BATCH_SIZE)
    ]

    for batch_idx, batch in enumerate(batches):
        try:
            user_prompt = _build_user_prompt(batch)
            raw = await provider.generate(system, user_prompt)
            parsed = _parse_llm_response(raw)

            for item in parsed:
                word = item.get("word", "").lower()
                if word:
                    results[word] = {
                        "simple_def": item.get("simple_def", ""),
                        "memory_tip": item.get("memory_tip", ""),
                        "llm_example": item.get("example", ""),
                        "translation": item.get("translation", ""),
                    }

        except Exception as e:
            logger.error(f"LLM batch {batch_idx} failed: {e}")
            # Continue with next batch — partial results are better than none

        if progress_callback:
            progress_callback(batch_idx + 1, len(batches))

    return results
