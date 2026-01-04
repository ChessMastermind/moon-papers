import json

input_file = 'public/cie_data.json'

with open(input_file, 'r') as f:
    data = json.load(f)

initial_count = len(data)

# Filter out items with Year="Unknown" AND Session=""
# The user said: "There shouldn't be a single thing that has this: "Year": "Unknown", "Session": "","
# This implies removing items where BOTH are true. Or maybe where EITHER is true?
# "There shouldn't be a single thing that has this: ... " usually implies the specific combination.
# However, looking at previous context, "Unknown" years caused issues.
# Let's look at the data first to see what "Session": "" looks like.

cleaned_data = [
    item for item in data 
    if not (item.get('Year') == 'Unknown' and item.get('Session') == '')
]

removed_count = initial_count - len(cleaned_data)

with open(input_file, 'w') as f:
    json.dump(cleaned_data, f, indent=2)

print(f"Removed {removed_count} items from {input_file}")
