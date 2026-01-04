import streamlit as st
import pandas as pd
import numpy as np

# ==========================================
# 1. PAGE CONFIGURATION & PERMANENT DARK MODE
# ==========================================
st.set_page_config(
    page_title="CIE Paper Browser",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Optimized CSS for Laptop Displays
st.markdown("""
<style>
    /* 1. GLOBAL BROWSER OVERRIDE */
    :root {
        color-scheme: dark;
    }

    /* 2. MAIN CONTAINERS */
    .stApp {
        background-color: #000000;
        color: #e0e0e0;
    }
    [data-testid="stSidebar"] {
        background-color: #111111;
        border-right: 1px solid #333;
    }

    /* 3. WIDGETS - FORCE DARK */
    div[data-baseweb="input"] > div, 
    div[data-baseweb="select"] > div,
    div[data-testid="stTextInput"] > div > div {
        background-color: #1a1a1a !important;
        color: white !important;
        border-color: #444 !important;
    }
    input, .stSelectbox div, .stMultiSelect div {
        color: white !important;
    }

    /* 4. DATAFRAME TABLE STYLING */
    .stDataFrame {
        border: 1px solid #333;
        border-radius: 8px;
        background-color: #000000;
    }

    /* 5. METRICS BOXES */
    [data-testid="stMetric"] {
        background-color: #111111;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #333;
    }
    [data-testid="stMetricLabel"] { color: #999; }
    [data-testid="stMetricValue"] { color: #fff; }

    /* 6. HEADERS & TEXT */
    h1, h2, h3, h4, h5, h6 {
        color: #ffffff !important;
        font-family: 'Helvetica Neue', sans-serif;
    }
    p, label {
        color: #cccccc !important;
    }

    /* Hide the index column */
    thead tr th:first-child { display:none }
    tbody th { display:none }
    
    [data-testid="stDataFrame"] > div {
        cursor: grab;
    }
    [data-testid="stDataFrame"] > div:active {
        cursor: grabbing;
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# 2. DATA ENGINE
# ==========================================
@st.cache_data(show_spinner=False)
def load_and_process_data():
    try:
        df = pd.read_csv('FULL_CIE_ARCHIVE.csv')
    except:
        return pd.DataFrame()

    df['Year_Val'] = pd.to_numeric(df['Year'], errors='coerce')
    df = df.dropna(subset=['Year_Val'])
    df['Year_Val'] = df['Year_Val'].astype(int)

    df['Level'] = df['Category'].str.strip("[]").fillna("CIE")
    sub_extract = df['Subject'].str.extract(r'\[(.*?) \((\d+)\)\]')
    df['Subject_Name'] = sub_extract[0].fillna("General")
    df['Subject_Code'] = sub_extract[1].fillna("")
    
    session_map = {'Feb/March': 'March', 'May/June': 'June', 'Oct/Nov': 'November'}
    df['Session'] = df['Extracted_Session'].map(session_map).fillna('Other')

    df['Comp_Raw'] = pd.to_numeric(df['Extracted_Component'], errors='coerce').fillna(0).astype(int)
    
    def parse_component(val):
        if val == 0: return "-", ""
        s = str(val)
        if len(s) == 2: return s, f"Paper {s[0]} Variant {s[1]}"
        return s, f"Paper {s}"

    comp_data = df['Comp_Raw'].apply(parse_component)
    df['Paper_Display'] = comp_data.apply(lambda x: x[0])
    df['Paper_Search_Name'] = comp_data.apply(lambda x: x[1])

    def categorize_type(t, filename):
        t, f = str(t).lower(), str(filename).lower()
        if 'qp' in t or '_qp_' in f: return 'Question Paper'
        if 'ms' in t or '_ms_' in f: return 'Mark Scheme'
        if 'er' in t or '_er_' in f: return 'Examiner Report'
        if 'gt' in t or '_gt_' in f: return 'Grade Thresholds'
        if 'sp' in t or '_sp_' in f: return 'Specimen Paper'
        if 'sy' in t or '_sy_' in f: return 'Syllabus'
        if 'ir' in t or 'ci' in t or '_ir_' in f: return 'Instructions'
        return 'Other'

    df['Type_Category'] = df.apply(lambda row: categorize_type(row['Extracted_Type'], row['Filename']), axis=1)

    df['Search_Context'] = (
        df['Level'].astype(str) + " " + df['Subject_Name'].astype(str) + " " + 
        df['Subject_Code'].astype(str) + " " + df['Year_Val'].astype(str) + " " + 
        df['Session'].astype(str) + " " + df['Type_Category'].astype(str) + " " +
        df['Paper_Display'].astype(str) + " " + df['Paper_Search_Name']
    ).str.lower()

    df.sort_values(by=['Year_Val', 'Subject_Name'], ascending=[False, True], inplace=True)
    return df

# ==========================================
# 3. UI LAYOUT
# ==========================================
def main():
    df = load_and_process_data()
    
    with st.sidebar:
        st.markdown("### 🔍 Filters")
        all_levels = sorted(df['Level'].unique()) if not df.empty else []
        selected_levels = st.multiselect("Levels", all_levels, default=all_levels)
        
        if not df.empty:
            min_y, max_y = int(df['Year_Val'].min()), int(df['Year_Val'].max())
            year_range = st.slider("Year Range", min_y, max_y, (min_y, max_y))
        else:
            year_range = (2000, 2025)

        st.write("**Document Types**")
        c1, c2 = st.columns(2)
        with c1:
            qp = st.checkbox("QP", True)
            ms = st.checkbox("MS", False)
            er = st.checkbox("Examiner Report", False)
        with c2:
            gt = st.checkbox("Grade boundaries", False)
            ot = st.checkbox("Other", False)

        type_mapping = {"Question Paper": qp, "Mark Scheme": ms, "Examiner Report": er, 
                        "Grade Thresholds": gt, "Other": ot, "Specimen Paper": ot, 
                        "Syllabus": ot, "Instructions": ot}
        selected_types = [k for k, v in type_mapping.items() if v]

        st.markdown("---")
        st.caption("🤝 **Credits**")
        st.caption("Host: [XtremePapers](https://papers.xtremepape.rs/)")
        st.caption("Partner: [cyboo 👻](https://www.reddit.com/r/alevel/comments/1pvaggf/a_better_way_to_solve_papers_easier_harder/)")

    st.title("⚡ CIE Paper Browser")
    
    if not df.empty:
        filtered_df = df[
            (df['Level'].isin(selected_levels)) & 
            (df['Type_Category'].isin(selected_types)) &
            (df['Year_Val'] >= year_range[0]) &
            (df['Year_Val'] <= year_range[1])
        ]
        
        search_col, comp_col = st.columns([3, 1])
        with search_col:
            search_query = st.text_input("", placeholder="Search (e.g. '0625 Physics')", label_visibility="collapsed")
        
        if search_query:
            clean_query = search_query.lower().replace("p", "paper ").replace("v", "variant ")
            for term in clean_query.split():
                filtered_df = filtered_df[filtered_df['Search_Context'].str.contains(term, na=False)]

        with comp_col:
            available_comps = sorted([c for c in filtered_df['Paper_Display'].unique() if c != "-"])
            selected_comps = st.multiselect("", options=available_comps, placeholder="Component #", label_visibility="collapsed")
        
        if selected_comps:
            filtered_df = filtered_df[filtered_df['Paper_Display'].isin(selected_comps)]

        # --- UPDATED METRICS LOGIC ---
        m1, m2, m3 = st.columns(3)
        m1.metric("Files", f"{len(filtered_df):,}")
        m2.metric("Subjects", filtered_df['Subject_Name'].nunique())
        
        if not filtered_df.empty:
            min_v = int(filtered_df['Year_Val'].min())
            max_v = int(filtered_df['Year_Val'].max())
            year_display = f"{min_v} - {max_v}" if min_v != max_v else str(min_v)
            m3.metric("Years", year_display)
        else:
            m3.metric("Years", "N/A")

        st.dataframe(
            filtered_df[['Level', 'Year_Val', 'Session', 'Subject_Code', 'Subject_Name', 'Type_Category', 'Paper_Display', 'Full_URL']],
            column_config={
                "Full_URL": st.column_config.LinkColumn("PDF", display_text="Open"),
                "Year_Val": "Year", "Subject_Code": "Code", "Subject_Name": "Subject", "Type_Category": "Type", "Paper_Display": "#"
            },
            hide_index=True, use_container_width=True, height=500 
        )
    else:
        st.error("No valid data found in CSV.")

if __name__ == "__main__":
    main()