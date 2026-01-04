import json

def analyze_cie():
    try:
        with open('public/cie_data.json', 'r') as f:
            data = json.load(f)
        
        missing_year = [item for item in data if not item.get('Year')]
        missing_session = [item for item in data if not item.get('Session')]
        accounting_0452 = [item for item in data if '0452' in item.get('Subject', '')]
        
        print(f"CIE Total: {len(data)}")
        print(f"CIE Missing Year: {len(missing_year)}")
        print(f"CIE Missing Session: {len(missing_session)}")
        
        if missing_year:
            print("Sample Missing Year:", missing_year[0])
        
        print(f"Accounting 0452 Count: {len(accounting_0452)}")
        # Check if any Accounting 0452 have missing year/session
        acc_missing = [item for item in accounting_0452 if not item.get('Year') or not item.get('Session')]
        print(f"Accounting 0452 Missing Year/Session: {len(acc_missing)}")
        if acc_missing:
            print("Sample Acc Missing:", acc_missing[0])

    except Exception as e:
        print(f"Error CIE: {e}")

def analyze_ial():
    try:
        with open('public/ial_data.json', 'r') as f:
            data = json.load(f)
            
        print(f"IAL Total: {len(data)}")
        
        # Check for MA03 or WMA03
        ma03 = [item for item in data if 'MA03' in item.get('Unit_Code', '')]
        wma03 = [item for item in data if 'WMA03' in item.get('Unit_Code', '')]
        
        print(f"IAL MA03 count: {len(ma03)}")
        print(f"IAL WMA03 count: {len(wma03)}")
        
        if ma03:
            print("Sample MA03:", ma03[0])
            
        # Check Subject mapping coverage
        # We'll simulate the mapping logic
        prefixes = set()
        for item in data:
            code = item.get('Unit_Code', '')
            if code:
                prefixes.add(code[:3])
        
        print(f"Unique Prefixes: {sorted(list(prefixes))}")

    except Exception as e:
        print(f"Error IAL: {e}")

if __name__ == "__main__":
    analyze_cie()
    analyze_ial()
