import sqlite3
from pathlib import Path

def migrate():
    db_path = Path("backend/data/audiobook.db")
    if not db_path.exists():
        print("No database found.")
        return

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute("PRAGMA table_info(dict_cache)")
    columns = [row[1] for row in c.fetchall()]
    
    if "inflections" not in columns:
        print("Adding 'inflections' column to dict_cache...")
        c.execute("ALTER TABLE dict_cache ADD COLUMN inflections TEXT DEFAULT '[]'")
        conn.commit()
        print("Column added.")
    else:
        print("Column already exists.")

    conn.close()

if __name__ == "__main__":
    migrate()
