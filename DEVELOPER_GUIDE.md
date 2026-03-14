# Developer Setup & Run Guide

This guide contains the necessary commands to set up the project locally, run both the backend and frontend servers, and basic Git commands for version control.

## 1. Environment Setup

### Backend (Python)
The backend requires a Python virtual environment to manage dependencies securely without affecting your global Python installation.

**Create a Virtual Environment (Run once)**
```bash
python3 -m venv .venv
```

**Activate the Virtual Environment**
*You must run this command every time you open a new terminal for the backend.*
- On macOS/Linux:
  ```bash
  source .venv/bin/activate
  ```
- On Windows:
  ```bash
  .venv\Scripts\activate
  ```

**Install Backend Dependencies**
```bash
pip install -r requirements.txt
```

### Frontend (Node.js/Next.js)
The frontend requires Node.js and its dependencies installed via npm.

**Navigate to the Client Directory**
```bash
cd client
```

**Install Frontend Dependencies**
```bash
npm install
```

---

## 2. Running the Servers

For the application to work, both the Backend API and Frontend Dashboard must be running simultaneously in **two separate terminal windows**.

### Starting the Backend Server
Open **Terminal 1**, ensure you are in the root directory and the virtual environment is activated:
```bash
# 1. Activate the virtual environment if you haven't already
source .venv/bin/activate

# 2. Start the FastAPI Server using Uvicorn
uvicorn server.main:app --reload --host 127.0.0.1 --port 8000
```
*The backend will be available at `http://127.0.0.1:8000`*

### Starting the Frontend Server
Open **Terminal 2**, navigate to the `client` directory:
```bash
# 1. Navigate to the frontend directory
cd client

# 2. Start the Next.js development server
npm run dev
```
*The dashboard will be available at `http://localhost:3000`*

### Stopping the Servers
To stop either server, go to its respective terminal window and press:
**`CTRL + C`**

---

## 3. Basic Git Commands

Git is used to track changes to your code and sync them with your GitHub repository.

**Check Repository Status**
*See which files have been modified, added, or deleted.*
```bash
git status
```

**Stage Changes for Commit**
*Add all modified and new files to the staging area.*
```bash
git add .
```
*(Optionally, replace `.` with a specific file path to stage only that file, e.g., `git add requirements.txt`)*

**Commit Changes**
*Save your staged changes locally with a descriptive message.*
```bash
git commit -m "Your descriptive commit message here"
```

**Push Changes to GitHub**
*Upload your local commits to the remote repository on GitHub.*
```bash
git push origin HEAD
```

**Pull Latest Changes**
*Download any new changes pushed by others to your local computer.*
```bash
git pull origin main
```
*(Replace `main` with your branch name, e.g., `V2`, if applicable)*
