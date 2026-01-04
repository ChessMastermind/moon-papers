import csv
import json
import re

def clean_category(cat):
    return cat.strip('[]')

def map_type(extracted_type):
    type_map = {
        'Question Paper': 'qp',
        'Mark Scheme': 'ms',
        'Examiner Report': 'er',
        'Grade Thresholds': 'gt',
        'Insert': 'insert',
        'Confidential Instructions': 'ci',
        'Other': 'other'
    }
    # Default to 'other' if not found or if extracted_type is empty
    return type_map.get(extracted_type, 'other')

data = []
with open('developmentfiles/cie.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        category = clean_category(row['Category'])
        subject = row['Subject'].strip('[]')
        
        # Use Extracted_Year if available, else Year
        year = row['Extracted_Year'] if row['Extracted_Year'] else row['Year']
        try:
            year = int(year)
        except:
            year = 'Unknown'
            
        session = row['Extracted_Session']
        
        # Map type
        # The CSV has 'Extracted_Type' which seems to be verbose like 'Examiner Report'
        # I need to check what values are in Extracted_Type
        type_ = map_type(row['Extracted_Type'])
        
        component = row['Extracted_Component']
        if not component:
            component = None
            
        # Unit seems to be the subject code number
        unit = row['Extracted_UnitCode']
        try:
            unit = float(unit)
        except:
            unit = None

        item = {
            "Category": category,
            "Subject": subject,
            "Year": year,
            "Session": session,
            "Type": type_,
            "Component": component,
            "URL": row['Full_URL'],
            "Unit": unit
        }
        data.append(item)

with open('public/cie_data.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f"Converted {len(data)} items.")
categories = set(d['Category'] for d in data)
print(f"Categories found: {categories}")
