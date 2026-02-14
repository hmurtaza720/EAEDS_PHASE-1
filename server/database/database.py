from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import os

# [Tahir Mehdi]: Using SQLite for portability during dev, easy to switch to Postgres later
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "dispatch.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine
# [Tahir Mehdi]: check_same_thread=False is critical for FastAPI's threaded concurrent architecture
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
