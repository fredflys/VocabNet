import sqlite3
from pathlib import Path

def migrate():
    db_path = Path("backend/data/audiobook.db")
    if not db_path.exists():
        print("No database found.")
        return

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Create user_profile table
    c.execute("""
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY DEFAULT 1,
            cefr_level TEXT DEFAULT 'B1',
            updated_at TEXT DEFAULT ''
        )
    """)
    conn.commit()
    print("user_profile table ensured.")

    # Add mastery_source column to user_vocab
    c.execute("PRAGMA table_info(user_vocab)")
    columns = [row[1] for row in c.fetchall()]

    if "mastery_source" not in columns:
        print("Adding 'mastery_source' column to user_vocab...")
        c.execute("ALTER TABLE user_vocab ADD COLUMN mastery_source TEXT DEFAULT 'study'")
        conn.commit()
        print("Column added.")
    else:
        print("mastery_source column already exists.")

    conn.close()

if __name__ == "__main__":
    migrate()
