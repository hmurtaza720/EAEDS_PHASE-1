import pypdf
import os

pdf_files = [
    "/Users/hassanrizvi/Documents/GitHub/EAEDS_FYP/Emotion-Aware-Emergency-Dispatch/4. FYP 1 Proposal Defence PPT.pdf"
]

for pdf_path in pdf_files:
    print(f"\n--- EXTRACTING: {os.path.basename(pdf_path)} ---\n")
    try:
        reader = pypdf.PdfReader(pdf_path)
        # Extract first 5 pages to get Problem Statement, Scope, Objectives
        text = ""
        for i in range(min(len(reader.pages), 20)): 
            text += reader.pages[i].extract_text() + "\n"
        print(text)
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
