import pytest
from services.parser import extract_text, split_into_chapters, _chunk_text


def test_chapter_detection_from_markers():
    """Chapters should be detected from <CHAPTER N|title> markers."""
    text = "<CHAPTER 1|Introduction>\nThis is chapter one content.\n\n<CHAPTER 2|Methods>\nThis is chapter two content."
    chapters = split_into_chapters(text)

    assert len(chapters) == 2
    assert chapters[0]["number"] == 1
    assert chapters[0]["title"] == "Introduction"
    assert "chapter one" in chapters[0]["text"]
    assert chapters[1]["number"] == 2
    assert chapters[1]["title"] == "Methods"


def test_gutenberg_boilerplate_stripping():
    """Gutenberg START/END markers should be stripped."""
    raw = (
        "Some header text\n"
        "*** START OF THE PROJECT GUTENBERG EBOOK ***\n\n"
        "Actual book content here.\n\n"
        "More real content.\n\n"
        "*** END OF THE PROJECT GUTENBERG EBOOK ***\n"
        "Some footer text"
    )
    result = extract_text(raw)
    assert "Some header text" not in result
    assert "Some footer text" not in result
    assert "Actual book content" in result or "real content" in result


def test_fallback_chunking_no_chapters():
    """Text without chapter markers should be chunked into sections."""
    # Generate text long enough to trigger chunking (>3000 words)
    words = ["word"] * 5000
    text = " ".join(words)
    result = _chunk_text(text)

    # Should have chapter markers injected
    assert "<CHAPTER" in result


def test_small_text_no_chunking():
    """Text too small (<3000 words) should not be chunked."""
    text = "A short text with just a few words."
    result = _chunk_text(text)
    assert "<CHAPTER" not in result
    assert result == text


def test_split_no_markers():
    """Text without markers should return empty chapters list."""
    text = "Just a plain text without any chapter markers."
    chapters = split_into_chapters(text)
    assert chapters == []


def test_chapter_word_counts():
    """Each chapter should have a word_count field."""
    text = "<CHAPTER 1|Part One>\nHello world this is content.\n\n<CHAPTER 2|Part Two>\nMore content here now."
    chapters = split_into_chapters(text)

    for ch in chapters:
        assert "word_count" in ch
        assert ch["word_count"] > 0


def test_chapter_offsets():
    """Each chapter should have start_offset and end_offset."""
    text = "<CHAPTER 1|Part One>\nContent one.\n\n<CHAPTER 2|Part Two>\nContent two."
    chapters = split_into_chapters(text)

    for ch in chapters:
        assert "start_offset" in ch
        assert "end_offset" in ch
        assert ch["end_offset"] > ch["start_offset"]


def test_extract_text_basic_cleaning():
    """extract_text should normalize excessive newlines and strip page numbers."""
    raw = "Line one\n\n\n\n\nLine two\n\n  42  \n\nLine three"
    result = extract_text(raw)
    # Excessive newlines should be reduced
    assert "\n\n\n" not in result
