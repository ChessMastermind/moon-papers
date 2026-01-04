import json
import os
import re

# Session mapping
SESSION_MAP = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
    "Feb/March": 3, "May/June": 6, "Oct/Nov": 11,
    "Winter": 11, "Summer": 6
}

FILES = {
    "IGCSE": "public/cie_IGCSE.json",
    "O Level": "public/cie_O_Level.json",
    "AS and A Level": "public/cie_AS_and_A_Level.json",
    "IAL": "public/ial_data.json"
}

def get_filename(url):
    if not url: return ""
    return url.split('/')[-1]

def extract_component(filename):
    # Try to extract component from filename like 0452_m15_ms_12.pdf -> 12
    # or 9709_s18_qp_42.pdf -> 42
    # Pattern: _[0-9]{2}.pdf or _[0-9]{2}_
    match = re.search(r'_(\d{2})\.pdf$', filename)
    if match:
        return match.group(1)
    match = re.search(r'_(\d{2})_', filename)
    if match:
        return match.group(1)
    return None

def process_file(filepath, level_name):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    print(f"Processing {filepath}...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    grouped = {}
    
    # Check format
    if isinstance(data, dict) and 'subjects' in data:
        print("Detected normalized format")
        subjects = data['subjects']
        sessions = data['sessions'] if 'sessions' in data else []
        types = data['types'] if 'types' in data else []
        rows = data['data']
        
        for row in rows:
            # row: [subj_idx, year, sess_idx, type_idx, url, unit]
            subj_idx = row[0]
            year = row[1]
            sess_idx = row[2]
            type_idx = row[3]
            url = row[4]
            
            subject = subjects[subj_idx]
            session_str = sessions[sess_idx] if sess_idx < len(sessions) else ""
            type_str = types[type_idx] if type_idx < len(types) else ""
            
            filename = get_filename(url)
            component = extract_component(filename)
            
            try:
                y_short = int(str(year)[-2:]) if year and str(year).isdigit() else 0
            except:
                y_short = 0
            s_short = SESSION_MAP.get(session_str, 0)
            
            # [y, s, t, c, u]
            record = [y_short, s_short, type_str, component, filename]
            
            if subject not in grouped:
                grouped[subject] = []
            grouped[subject].append(record)
            
    elif isinstance(data, list):
        print("Detected flat list format")
        for item in data:
            # Handle short keys from previous optimization
            subject = item.get('Subject') or item.get('S') or item.get('Unit_Code') or item.get('uc')
            if not subject: continue
            
            year = item.get('Year') or item.get('y')
            session = item.get('Session') or item.get('s')
            type_ = item.get('Type') or item.get('t')
            url = item.get('URL') or item.get('u')
            component = item.get('Component') or item.get('C')
            
            filename = get_filename(url)
            if not component:
                component = extract_component(filename)
                
            try:
                y_short = int(str(year)[-2:]) if year and str(year).isdigit() else 0
            except:
                y_short = 0
            s_short = SESSION_MAP.get(session, 0)
            
            # For IAL, keep full URL as it is not reconstructible
            # For CIE, keep filename
            url_to_store = url if level_name == 'IAL' else filename
            
            record = [y_short, s_short, type_, component, url_to_store]
            
            if subject not in grouped:
                grouped[subject] = []
            grouped[subject].append(record)
            
    # Split and Save
    json_str = json.dumps(grouped, separators=(',', ':'))
    size_mb = len(json_str) / (1024 * 1024)
    print(f"Total size for {level_name}: {size_mb:.2f} MB")
    
    if size_mb > 0.95:
        print(f"Splitting {level_name}...")
        chunks = {}
        current_chunk_idx = 1
        current_chunk_size = 0
        current_chunk_data = {}
        
        sorted_subjects = sorted(grouped.keys())
        
        for subj in sorted_subjects:
            subj_data = grouped[subj]
            subj_str = json.dumps({subj: subj_data}, separators=(',', ':'))
            subj_size = len(subj_str)
            
            if current_chunk_size + subj_size > 800 * 1024:
                save_chunk(filepath, current_chunk_idx, current_chunk_data)
                current_chunk_idx += 1
                current_chunk_data = {}
                current_chunk_size = 0
            
            current_chunk_data[subj] = subj_data
            current_chunk_size += subj_size
            
        if current_chunk_data:
            save_chunk(filepath, current_chunk_idx, current_chunk_data)
            
        if os.path.exists(filepath):
            os.remove(filepath)
        print(f"Removed original {filepath}")
        
    else:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(json_str)
        print(f"Saved optimized {filepath}")

def save_chunk(original_path, idx, data):
    base, ext = os.path.splitext(original_path)
    new_path = f"{base}_{idx}{ext}"
    with open(new_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"Saved chunk {new_path}")

if __name__ == "__main__":
    if os.path.exists("public/cie_data.json"):
        os.remove("public/cie_data.json")
        print("Deleted public/cie_data.json")

    for level, path in FILES.items():
        process_file(path, level)
