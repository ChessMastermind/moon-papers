import pandas as pd
import io
import json
import re
import os

def extract_ial_data(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find the CSV_DATA string
    match = re.search(r'CSV_DATA = """(.*?)"""', content, re.DOTALL)
    if match:
        csv_content = match.group(1).strip()
        df = pd.read_csv(io.StringIO(csv_content))
        
        # Filter out 2025 papers
        # Extract year from Title
        df['Year'] = df['Title'].str.extract(r'(\d{4})')
        df = df[df['Year'] != '2025']
        
        # Minimal fields
        # We need Unit_Code, Title, URL. 
        # We can pre-parse Session and Type to save client work
        df['Session'] = df['Title'].str.extract(r'(January|February|March|April|May|June|July|August|September|October|November|December)')
        
        def get_type(title):
            t = title.lower()
            if 'question paper' in t: return 'qp'
            if 'mark scheme' in t: return 'ms'
            if 'examiner report' in t: return 'er'
            return 'other'
            
        df['Type'] = df['Title'].apply(get_type)
        
        # Select minimal columns
        df = df[['Unit_Code', 'Title', 'URL', 'Year', 'Session', 'Type']]
        
        # Replace NaN with None for valid JSON
        df = df.where(pd.notnull(df), None)
        
        return df.to_dict(orient='records')
    return []

def extract_cie_data(file_path):
    if os.path.exists(file_path):
        df = pd.read_csv(file_path)
        
        # Filter Categories
        df['Category'] = df['Category'].astype(str).str.replace(r'[\[\]]', '', regex=True)
        df = df[df['Category'].isin(['AS and A Level', 'IGCSE', 'O Level'])]
        
        # Filter Year
        df = df[df['Year'] != 2025]
        
        # Clean Subject
        df['Subject'] = df['Subject'].astype(str).str.replace(r'[\[\]]', '', regex=True)
        
        # Minimal fields
        # Rename for consistency/minification
        df = df.rename(columns={
            'Extracted_Session': 'Session',
            'Extracted_Type': 'Type',
            'Extracted_Component': 'Component',
            'Full_URL': 'URL',
            'Extracted_UnitCode': 'Unit'
        })
        
        # Simplify Type
        def simplify_type(t):
            if pd.isna(t): return 'other'
            t = str(t).lower()
            if 'question paper' in t: return 'qp'
            if 'mark scheme' in t: return 'ms'
            if 'examiner report' in t: return 'er'
            if 'grade thresholds' in t: return 'gt'
            return 'other'
            
        df['Type'] = df['Type'].apply(simplify_type)
        
        # Select columns
        df = df[['Category', 'Subject', 'Year', 'Session', 'Type', 'Component', 'URL', 'Unit']]
        
        df = df.astype(object)
        df = df.where(pd.notnull(df), None)
        return df.to_dict(orient='records')
    return []

# Extract IAL
ial_data = extract_ial_data('developmentfiles/main-ial.py')
if ial_data:
    with open('public/ial_data.json', 'w') as f:
        json.dump(ial_data, f, indent=2)
    print(f"Extracted {len(ial_data)} IAL records to public/ial_data.json")

# Extract CIE
cie_data = extract_cie_data('developmentfiles/cie.csv')
if cie_data:
    with open('public/cie_data.json', 'w') as f:
        json.dump(cie_data, f, indent=2)
    print(f"Extracted {len(cie_data)} CIE records to public/cie_data.json")




