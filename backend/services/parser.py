"""
Text extraction and pre-processing for .txt and .epub files.
Unified Chapterization Engine v4.

Features:
- EPUB: Semantic header extraction (h1/h2) for chapter titles.
- TXT: Structural Entropy validation and Lookahead Titling.
- Standardized Marker: <CHAPTER num|title>
"""
import re
import io
from typing import List, Tuple, Optional

# ── Project Gutenberg boilerplate markers ──────────────────────────────────
_GUTENBERG_START_RE = re.compile(r"\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG", re.I)
_GUTENBERG_END_RE = re.compile(r"\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG", re.I)

# ── Chapter heading detection (TXT) ───────────────────────────────────────
_CHAPTER_RE = re.compile(
    r"^[ \t]*(chapter|part|book|section|prologue|epilogue|preface|introduction|conclusion)"
    r"(?:[ \t]+(?:[IVXLCDM]+|[ivxlcdm]+|\d+|[Oo]ne|[Tt]wo|[Tt]hree|[Ff]our|[Ff]ive|[Ss]ix|[Ss]even|[Ee]ight|[Nn]ine|[Tt]en))?[ \t]*"
    r"(?:[:\-–—][ \t]*)?$",
    re.M | re.I
)

def extract_text(raw: str) -> str:
    """Clean prose text and inject standardized chapter markers."""
    text = raw

    # 1. Strip Boilerplate
    start_match = _GUTENBERG_START_RE.search(text)
    if start_match:
        after_marker = text[start_match.end():]
        blank = after_marker.find("\n\n")
        text = after_marker[blank:] if blank != -1 else after_marker

    end_match = _GUTENBERG_END_RE.search(text)
    if end_match:
        text = text[:end_match.start()]

    # 2. Basic Cleaning
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.M)
    text = text.strip()

    # 3. Heuristic Chapterization
    return _inject_txt_markers(text)

def _inject_txt_markers(text: str) -> str:
    """Inject <CHAPTER num|title> markers using Structural Entropy rules."""
    lines = text.split("\n")
    candidates = []
    
    for i, line in enumerate(lines):
        clean_line = line.strip()
        if not clean_line or len(clean_line) > 60: continue
        
        if _CHAPTER_RE.match(clean_line):
            # Structural Check: Must be surrounded by empty lines (approx)
            prev_empty = i == 0 or not lines[i-1].strip()
            next_empty = i == len(lines)-1 or not lines[i+1].strip()
            
            if prev_empty and next_empty:
                # Lookahead for title: Check the next non-empty line
                title = clean_line
                next_idx = i + 1
                while next_idx < len(lines) and not lines[next_idx].strip():
                    next_idx += 1
                
                if next_idx < len(lines):
                    potential_title = lines[next_idx].strip()
                    # If it looks like a title (short, no punctuation at end)
                    if 0 < len(potential_title) < 50 and potential_title[-1] not in ".?!\"":
                        title = f"{clean_line}: {potential_title}"
                
                candidates.append({"line_idx": i, "title": title})

    # Structural Density Validation: 
    # If we find > 1 chapter per 500 words, it's likely noise (e.g. TOC or references)
    word_count = len(text.split())
    max_allowed = max(2, word_count // 500)
    
    if len(candidates) < 2 or len(candidates) > max_allowed:
        # Fallback: Sematic Chunking (2500 words)
        return _chunk_text(text)

    # Replace lines with markers
    new_lines = list(lines)
    for idx, cand in enumerate(candidates):
        new_lines[cand["line_idx"]] = f"<CHAPTER {idx+1}|{cand['title']}>"
    
    return "\n".join(new_lines)

def _chunk_text(text: str) -> str:
    """Split text into 2500-word logical chunks if no chapters detected."""
    words = text.split()
    if len(words) < 3000: return text # Too small to chunk
    
    CHUNK_SIZE = 2500
    chunks = []
    for i in range(0, len(words), CHUNK_SIZE):
        chunk_num = (i // CHUNK_SIZE) + 1
        marker = f"<CHAPTER {chunk_num}|Section {chunk_num}>"
        chunks.append(marker + "\n" + " ".join(words[i : i + CHUNK_SIZE]))
    
    return "\n\n".join(chunks)

def split_into_chapters(text: str) -> List[dict]:
    """Split text by standardized <CHAPTER num|title> markers."""
    marker_re = re.compile(r"<CHAPTER (\d+)\|(.*?)>")
    markers = list(marker_re.finditer(text))
    
    if not markers: return []

    chapters = []
    for i, m in enumerate(markers):
        num = int(m.group(1))
        title = m.group(2).strip()
        
        start_content = m.end()
        end_content = markers[i+1].start() if i+1 < len(markers) else len(text)
        
        content = text[start_content:end_content].strip()
        if content:
            chapters.append({
                "number": num,
                "title": title,
                "text": content,
                "word_count": len(content.split()),
                "start_offset": start_content,
                "end_offset": end_content
            })
    return chapters

def extract_epub(content: bytes) -> Tuple[str, str, str]:
    """Extract text and semantic titles from EPUB."""
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup

    book = epub.read_epub(io.BytesIO(content))
    title = (book.get_metadata("DC", "title") or [("Unknown",)])[0][0]
    author = (book.get_metadata("DC", "creator") or [("Unknown",)])[0][0]

    chapter_parts = []
    ch_count = 0

    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), "lxml")
        
        # 1. Clean HTML junk (scripts, styles)
        for s in soup(["script", "style"]): s.decompose()
        
        # 2. Attempt Title Extraction
        # Look for the first major heading
        header = soup.find(['h1', 'h2', 'h3'])
        ch_title = header.get_text().strip() if header else f"Chapter {ch_count + 1}"
        
        # 3. Get text content
        raw_text = soup.get_text(separator="\n").strip()
        if len(raw_text) < 200: continue # Skip TOC, covers, small files

        ch_count += 1
        # Normalize title: remove "Chapter 1" prefix if already present in extracted title
        clean_ch_title = re.sub(r"^(chapter|part|section)\s*\d+\s*[:\-]?\s*", "", ch_title, flags=re.I).strip()
        final_title = f"Chapter {ch_count}"
        if clean_ch_title and clean_ch_title.lower() != final_title.lower():
            final_title = f"{final_title}: {clean_ch_title}"

        chapter_parts.append(f"<CHAPTER {ch_count}|{final_title}>\n{raw_text}")

    full_text = "\n\n".join(chapter_parts)
    return _clean_epub_text(full_text), title, author

def _clean_epub_text(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
