import json
import os

def split_cie_data():
    input_file = 'public/cie_data.json'
    
    if not os.path.exists(input_file):
        print(f"File {input_file} not found.")
        return

    print(f"Reading {input_file}...")
    with open(input_file, 'r') as f:
        data = json.load(f)

    print(f"Total records: {len(data)}")

    # Group by Category
    grouped_data = {}
    
    for item in data:
        category = item.get('Category')
        if not category:
            print(f"Warning: Item without category: {item}")
            continue
            
        if category not in grouped_data:
            grouped_data[category] = []
        
        grouped_data[category].append(item)

    # Save to separate files
    for category, items in grouped_data.items():
        # Create a safe filename
        safe_filename = category.replace(' ', '_').replace('&', 'and')
        output_file = f'public/cie_{safe_filename}.json'
        
        print(f"Saving {len(items)} records to {output_file}...")
        with open(output_file, 'w') as f:
            json.dump(items, f)

    print("Done.")

if __name__ == "__main__":
    split_cie_data()
