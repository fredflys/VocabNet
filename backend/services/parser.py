"""
Text extraction and pre-processing for .txt and .epub files.
Phase 4+: Smart chapter detection with graceful fallback.

EPUB: Uses existing ITEM_DOCUMENT structure with heading-based naming.
TXT:  Multi-pattern regex for chapter headings; falls back to no chapters
      if fewer than 2 are detected (avoids false positives).
"""
import re


# ── Project Gutenberg boilerplate markers ──────────────────────────────────
_GUTENBERG_START_RE = re.compile(
    r"\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG",
    re.IGNORECASE,
)
_GUTENBERG_END_RE = re.compile(
    r"\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG",
    re.IGNORECASE,
)

# ── Chapter heading detection (TXT) ───────────────────────────────────────
# Matches lines like:
#   CHAPTER 1 / Chapter I / PART IV / Part Two / Chapter One
#   The line must be ONLY the heading (possibly with a title after), not mid-sentence.
# We require the heading to appear on its own line, possibly preceded/followed by blank lines.
_CHAPTER_RE = re.compile(
    r"^[ \t]*(chapter|part|book|section|prologue|epilogue|preface|introduction|conclusion)"
    r"(?:[ \t]+(?:[IVXLCDM]+|[ivxlcdm]+|\d+|[Oo]ne|[Tt]wo|[Tt]hree|[Ff]our|[Ff]ive|"
    r"[Ss]ix|[Ss]even|[Ee]ight|[Nn]ine|[Tt]en|[Ee]leven|[Tt]welve|[Ff]irst|[Ss]econd|"
    r"[Tt]hird|[Ff]ourth|[Ff]ifth|[Ss]ixth|[Ss]eventh|[Ee]ighth|[Nn]inth|[Tt]enth))?[ \t]*"
    r"(?:[:\-–—][ \t]*.*)?$",
    re.MULTILINE | re.IGNORECASE,
)

# Minimum chapters before we consider chapterisation valid
_MIN_CHAPTERS = 2


def extract_text(raw: str) -> str:
    """
    Given raw .txt content, return clean prose text (optionally with chapter markers).
    - Strips Project Gutenberg header/footer if present
    - Attempts chapter detection; inserts <CHAPTER N> markers if ≥2 chapters found
    - Falls back to plain text (no markers) when detection fails
    """
    text = raw

    # Strip Project Gutenberg boilerplate
    start_match = _GUTENBERG_START_RE.search(text)
    if start_match:
        after_marker = text[start_match.end():]
        blank = after_marker.find("\n\n")
        text = after_marker[blank:] if blank != -1 else after_marker

    end_match = _GUTENBERG_END_RE.search(text)
    if end_match:
        text = text[: end_match.start()]

    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove standalone page numbers
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)

    text = text.strip()

    # Try chapter detection
    text = _inject_chapter_markers(text)

    return text


def _inject_chapter_markers(text: str) -> str:
    """
    Replace chapter headings with <CHAPTER N> markers.
    Returns text unchanged if fewer than _MIN_CHAPTERS detected
    (prevents false positives on books with inline "Chapter" references).
    """
    chapter_counter = [0]
    candidate_positions = []

    # First pass: collect all matches
    for m in _CHAPTER_RE.finditer(text):
        # Require the match to be on a mostly-blank line:
        # The full line should be short (≤ 100 chars) to avoid matching
        # sentences that happen to start with "Chapter" mid-paragraph.
        full_line = m.group(0).strip()
        if len(full_line) > 100:
            continue
        candidate_positions.append(m)

    if len(candidate_positions) < _MIN_CHAPTERS:
        # Not enough chapters — return text unchanged (no chapter markers)
        return text

    # Second pass: replace from end to start so positions remain valid
    for m in reversed(candidate_positions):
        chapter_counter[0] += 1

    # Reset and replace forward (counter must match order)
    chapter_counter[0] = 0
    result = []
    prev_end = 0
    for m in candidate_positions:
        chapter_counter[0] += 1
        result.append(text[prev_end:m.start()])
        result.append(f"<CHAPTER {chapter_counter[0]}>")
        prev_end = m.end()
    result.append(text[prev_end:])

    return "".join(result)


def split_into_chapters(text: str) -> list[dict]:
    """
    Split text by <CHAPTER N> markers.
    Returns list of { number, text, word_count }.
    If no markers found, returns empty list (no chapterisation).
    """
    marker_re = re.compile(r"<CHAPTER (\d+)>")
    parts = marker_re.split(text)

    if len(parts) <= 1:
        # No chapter markers — caller treats this as "no chapters"
        return []

    chapters = []

    # parts[0] is preamble (before first chapter) — skip if trivial
    # Alternating: chapter_number, chapter_text, ...
    for i in range(1, len(parts), 2):
        ch_num = int(parts[i])
        ch_text = parts[i + 1].strip() if i + 1 < len(parts) else ""
        if ch_text:
            chapters.append({
                "number": ch_num,
                "text": ch_text,
                "word_count": len(ch_text.split()),
            })

    return chapters


def extract_epub(content: bytes) -> tuple[str, str, str]:
    """
    Extract clean text + metadata from an EPUB file.
    Returns: (full_text, title, author)

    EPUB chapterisation is reliable — each ITEM_DOCUMENT is a chapter.
    We use the heading text as the chapter title when available.
    """
    import io
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup

    book = epub.read_epub(io.BytesIO(content))

    # Metadata
    title_meta = book.get_metadata("DC", "title")
    title = title_meta[0][0] if title_meta else "Unknown"
    author_meta = book.get_metadata("DC", "creator")
    author = author_meta[0][0] if author_meta else "Unknown"

    # Extract text from all document items
    ch_count = 0
    chapter_parts = []

    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), "lxml")
        text = soup.get_text(separator="\n").strip()

        if not text:
            continue

        # Only count as a chapter if it has meaningful content (>100 chars)
        # Avoids treating cover pages, TOC, etc. as chapters
        if len(text) < 100:
            continue

        ch_count += 1
        chapter_parts.append(f"<CHAPTER {ch_count}>\n{text}")

    full_text = "\n\n".join(chapter_parts)
    full_text = _clean_epub_text(full_text)

    return full_text, title, author


def _clean_epub_text(text: str) -> str:
    """Clean EPUB text without re-running chapter detection (markers already set)."""
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    return text.strip()
