import json
import os

# Configuration
files_to_process = [
    "public/cie_IGCSE.json",
    "public/cie_O_Level.json",
    "public/cie_AS_and_A_Level.json",
    "public/ial_data.json"
]

COMMON_URL_PREFIX = "https://papers.xtremepape.rs/CAIE/"
IAL_URL_PREFIX = "https://qualifications.pearson.com/content/dam/pdf/International Advanced Level/"

def compress_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    print(f"Compressing {filepath}...")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Dictionaries for deduplication
        subjects = []
        subject_map = {}
        
        sessions = []
        session_map = {}
        
        types = []
        type_map = {}
        
        compressed_rows = []
        
        is_ial = "ial" in filepath
        url_prefix = IAL_URL_PREFIX if is_ial else COMMON_URL_PREFIX
        
        for item in data:
            # Handle mapped keys from previous optimization or original keys
            # We support both for robustness
            
            # Extract values
            subj = item.get('S') or item.get('Subject') or item.get('Unit_Code') # IAL uses Unit_Code as subject-like grouper sometimes, but let's stick to Subject if available
            if is_ial:
                 subj = item.get('uc') or item.get('Unit_Code') # For IAL we group by Unit Code in the UI often
            
            year = item.get('y') or item.get('Year')
            sess = item.get('s') or item.get('Session')
            typ = item.get('t') or item.get('Type')
            url = item.get('u') or item.get('URL')
            unit = item.get('U') or item.get('Unit')
            component = item.get('C') or item.get('Component')
            title = item.get('T') or item.get('Title') # IAL specific
            
            # 1. Subject Index
            if subj not in subject_map:
                subject_map[subj] = len(subjects)
                subjects.append(subj)
            subj_idx = subject_map[subj]
            
            # 2. Session Index
            if sess not in session_map:
                session_map[sess] = len(sessions)
                sessions.append(sess)
            sess_idx = session_map[sess]
            
            # 3. Type Index
            if typ not in type_map:
                type_map[typ] = len(types)
                types.append(typ)
            typ_idx = type_map[typ]
            
            # 4. URL Compression
            clean_url = url
            if url and url.startswith(url_prefix):
                clean_url = url[len(url_prefix):]
            
            # Row structure: [SubjectIdx, Year, SessionIdx, TypeIdx, URL, Unit/Component/Title]
            # We combine Unit/Component/Title into the last field depending on what's available
            extra = unit if unit is not None else (component if component is not None else title)
            
            row = [subj_idx, year, sess_idx, typ_idx, clean_url, extra]
            compressed_rows.append(row)
            
        # Final Structure
        output = {
            "subjects": subjects,
            "sessions": sessions,
            "types": types,
            "data": compressed_rows,
            "is_ial": is_ial
        }
            
        # Write back
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output, f, separators=(',', ':'))
            
        print(f"Compressed {filepath}")
        
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    for file in files_to_process:
        compress_file(file)
