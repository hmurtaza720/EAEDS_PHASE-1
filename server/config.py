import os
from dotenv import load_dotenv

from pathlib import Path

# Robustly find .env file relative to this script
base_dir = Path(__file__).parent
env_path = base_dir / ".env"
load_dotenv(dotenv_path=env_path)

env_local_path = base_dir / ".env.local"
loaded = load_dotenv(dotenv_path=env_local_path)
print(f" [Config Debug] Loading .env.local from {env_local_path.absolute()}: {loaded}")

# Select the Brain Layer
# Select the Brain Layer
# Options: "MOCK", "LOCAL"
AI_MODE = os.getenv("AI_MODE", "LOCAL")
print(f" [Config Debug] Loaded AI_MODE: {AI_MODE}")

# API Keys
# GROQ_API_KEY removed for Local-First Architecture

print(f" [Config] System Configured for Mode: {AI_MODE}")
