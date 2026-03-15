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
        try:
            cursor.execute("ALTER TABLE calls ADD COLUMN latitude REAL")
        except sqlite3.OperationalError:
            pass # Column already exists
        try:
            cursor.execute("ALTER TABLE calls ADD COLUMN longitude REAL")
        except sqlite3.OperationalError:
            pass # Column already exists
        try:
            cursor.execute("ALTER TABLE calls ADD COLUMN ended_by TEXT")
        except sqlite3.OperationalError:
            pass # Column already exists
            
        conn.commit()
        conn.close()
        print(f" [DB] Database initialized at {DB_PATH}")

    def generate_call_id(phone: str, dt: datetime, city_state: str) -> str:
        """Generates a standardized Call ID: PHONE-YYYYMMDD-HHMM-CITY"""
        import re
        # Extract last 4 digits of phone, fallback to 0000
        phone_nums = re.sub(r'[^0-9]', '', str(phone)) if phone else ""
        phone_part = phone_nums[-4:] if len(phone_nums) >= 4 else phone_nums.zfill(4)
        if not phone_part or phone_part == "0000":
            phone_part = "0000"
            
        date_part = dt.strftime("%Y%m%d")
        time_part = dt.strftime("%H%M")
        
        # Extract city/state snippet
        if city_state and city_state != "Unknown":
            parts = city_state.split(',')
            state_token = parts[-1].strip() if len(parts) > 1 else parts[0].strip()
            loc_part = re.sub(r'[^A-Z]', '', state_token.upper())[:4]
            if not loc_part: loc_part = "UNK"
        else:
            loc_part = "UNK"
            
        return f"{phone_part}-{date_part}-{time_part}-{loc_part}"

    def save_call(self, transcript_list: list, emotion: str, location: str, phone: str = "Unknown", city_state: str = "Unknown", severity: str = "RESOLVED", dispatched_services: str = "", call_id: str = None, latitude: float = None, longitude: float = None, started_at: datetime = None, ended_by: str = "Caller"):
        """Saves a completed call to the database."""
        ended_at = datetime.now()
        
        # If no start time provided, assume it just started (fallback)
        if not started_at:
            started_at = ended_at
        
        # Calculate duration
        duration_delta = ended_at - started_at
        duration_seconds = int(duration_delta.total_seconds())
        
        if not call_id:
            call_id = DatabaseManager.generate_call_id(phone, started_at, city_state)
        
        transcript_json = json.dumps(transcript_list)
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO calls (id, started_at, ended_at, caller_location, detected_emotion, transcript, duration_seconds, caller_phone, caller_city_state, severity, dispatched_services, latitude, longitude, ended_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (call_id, started_at, ended_at, location, emotion, transcript_json, duration_seconds, phone, city_state, severity, dispatched_services, latitude, longitude, ended_by))
        conn.commit()
        conn.close()
        print(f" [DB] Call saved: {call_id} | Duration: {duration_seconds}s | Ended By: {ended_by}")
        return call_id

    def get_recent_calls(self, limit=500):
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
