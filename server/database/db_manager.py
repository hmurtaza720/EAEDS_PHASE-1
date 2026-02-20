import sqlite3
import json
import os
from datetime import datetime
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), "calls.db")

class DatabaseManager:
    def __init__(self):
        self._init_db()

    def _init_db(self):
        """Creates the calls table if it doesn't exist."""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS calls (
                id TEXT PRIMARY KEY,
                started_at DATETIME,
                ended_at DATETIME,
                caller_location TEXT,
                detected_emotion TEXT,
                transcript TEXT,
                duration_seconds INTEGER
            )
        ''')
        
        # Add column if it doesn't exist (version upgrade)
        try:
            cursor.execute("ALTER TABLE calls ADD COLUMN caller_phone TEXT")
        except sqlite3.OperationalError:
            pass # Column already exists
        try:
            cursor.execute("ALTER TABLE calls ADD COLUMN caller_city_state TEXT")
        except sqlite3.OperationalError:
            pass # Column already exists
        try:
            cursor.execute("ALTER TABLE calls ADD COLUMN severity TEXT DEFAULT 'RESOLVED'")
        except sqlite3.OperationalError:
            pass # Column already exists
        try:
            cursor.execute("ALTER TABLE calls ADD COLUMN dispatched_services TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass # Column already exists
            
        conn.commit()
        conn.close()
        print(f" [DB] Database initialized at {DB_PATH}")

    def save_call(self, transcript_list: list, emotion: str, location: str, phone: str = "Unknown", city_state: str = "Unknown", severity: str = "RESOLVED", dispatched_services: str = ""):
        """Saves a completed call to the database."""
        call_id = str(uuid.uuid4())
        ended_at = datetime.now()
        started_at = ended_at # Simplified for now
        
        transcript_json = json.dumps(transcript_list)
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO calls (id, started_at, ended_at, caller_location, detected_emotion, transcript, duration_seconds, caller_phone, caller_city_state, severity, dispatched_services)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (call_id, started_at, ended_at, location, emotion, transcript_json, 0, phone, city_state, severity, dispatched_services))
        conn.commit()
        conn.close()
        print(f" [DB] Call saved: {call_id} | Emotion: {emotion} | Phone: {phone} | Severity: {severity} | Dispatched: {dispatched_services}")
        return call_id

    def get_recent_calls(self, limit=10):
        """Retrieves the most recent calls."""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM calls ORDER BY ended_at DESC LIMIT ?', (limit,))
        rows = cursor.fetchall()
        conn.close()
        
        calls = []
        for row in rows:
            calls.append(dict(row))
        return calls
