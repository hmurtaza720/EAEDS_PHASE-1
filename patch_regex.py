import re
import json

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace <ACTION> with <\s*ACTION\s*> inside regex
    content = content.replace(r"r'<ACTION>", r"r'<\s*ACTION\s*>")
    content = content.replace(r"r'(?:<ACTION>", r"r'(?:<\s*ACTION\s*>")
    
    # Replace </ACTION> with <\s*/\s*ACTION\s*>
    # This also fixes the system prompt which is fine (helps the LLM understand spaces are okay)
    content = content.replace(r"</ACTION>", r"<\s*/\s*ACTION\s*>")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Patched {filepath}')

patch_file('colab_rag_api.py')
patch_file('convert_to_notebook.py')
patch_file('colab_rag_api.ipynb')
