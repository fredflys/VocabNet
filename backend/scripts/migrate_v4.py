import sqlite3
import json
from pathlib import Path
import sys
import os

def migrate():
    db_path = Path("backend/data/audiobook.db")
    if not db_path.exists():
        print("No database found, nothing to migrate.")
        return

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 1. Update book_chapters schema
    print("Checking for new columns in book_chapters...")
    c.execute("PRAGMA table_info(book_chapters)")
    columns = [row[1] for row in c.fetchall()]
    
    if "title" not in columns:
        print("Adding 'title' column...")
        c.execute("ALTER TABLE book_chapters ADD COLUMN title TEXT DEFAULT 'Untitled Chapter'")
    
    if "start_offset" not in columns:
        print("Adding 'start_offset' column...")
        c.execute("ALTER TABLE book_chapters ADD COLUMN start_offset INTEGER DEFAULT 0")
        
    if "end_offset" not in columns:
        print("Adding 'end_offset' column...")
        c.execute("ALTER TABLE book_chapters ADD COLUMN end_offset INTEGER DEFAULT 0")

    # 2. Create association table
    print("Checking for book_vocab_chapter_links table...")
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='book_vocab_chapter_links'")
    if not c.fetchone():
        print("Creating book_vocab_chapter_links table...")
        c.execute("""
            CREATE TABLE book_vocab_chapter_links (
                vocab_id INTEGER NOT NULL,
                chapter_id INTEGER NOT NULL,
                PRIMARY KEY (vocab_id, chapter_id),
                FOREIGN KEY(vocab_id) REFERENCES book_vocab (id) ON DELETE CASCADE,
                FOREIGN KEY(chapter_id) REFERENCES book_chapters (id) ON DELETE CASCADE
            )
        """)

    # 3. Data Migration: Populate links from BookVocab.chapter_list
    print("Migrating chapter links from JSON to association table...")
    
    # Mapping of (book_id, chapter_number) -> chapter_id
    c.execute("SELECT id, book_id, chapter_number FROM book_chapters")
    chapter_rows = c.fetchall()
    chapter_map = {(row[1], row[2]): row[0] for row in chapter_rows}
    
    # Get vocab data
    c.execute("SELECT id, book_id, chapter_list FROM book_vocab")
    vocab_data = c.fetchall()
    
    links_to_insert = []
    for v_id, b_id, ch_list_json in vocab_data:
        try:
            # chapter_list might be stored as a JSON string
            ch_nums = json.loads(ch_list_json) if ch_list_json else []
            if isinstance(ch_nums, int): ch_nums = [ch_nums]
            
            for ch_num in ch_nums:
                ch_id = chapter_map.get((b_id, ch_num))
                if ch_id:
                    links_to_insert.append((v_id, ch_id))
        except Exception as e:
            # Fallback for non-JSON or malformed data
            continue
            
    if links_to_insert:
        print(f"Inserting {len(links_to_insert)} links...")
        c.executemany("INSERT OR IGNORE INTO book_vocab_chapter_links (vocab_id, chapter_id) VALUES (?, ?)", links_to_insert)

    conn.commit()
    conn.close()
    print("Migration v4 complete.")

if __name__ == "__main__":
    migrate()
