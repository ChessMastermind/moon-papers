# Moon Papers 🌙

**Live Site:** [moon-papers.com](https://moon-papers.com)

Moon Papers is a lightweight, high-performance web application designed to help students and teachers quickly access past examination papers for **Cambridge International (CIE)** and **Pearson Edexcel (IAL)**.

## ✨ Features
* **Comprehensive Database:** Indexes resources for IGCSE, O Level, AS & A Level (CIE), and International Advanced Level (Pearson Edexcel).
* **Fast Search:** Instant filtering by subject, unit code, year, or exam session.
* **Optimized Data:** Large datasets are minified and split into manageable JSON chunks to ensure rapid loading in the browser.
* **Direct Access:** Links directly to public PDF repositories for question papers, mark schemes, and examiner reports.

## 🛠️ Tech Stack
* **Frontend:** React built with Vite.
* **Styling & Icons:** Tailwind-inspired CSS and Lucide React icons.
* **Data Processing:** Python scripts using Pandas for extraction and optimization.

## 📁 Repository Structure
* `src/`: Core React application logic and components.
* `public/`: Minified and split JSON data stores (e.g., `igcse_1.json`, `alevel_1.json`, `ial.json`).
* `developmentfiles/`: Raw source data including CSVs and manual scripts used for indexing.
* **Data Scripts** (Root):
    * `extract_data.py`: Parses raw data from CSVs and scripts into structured JSON.
    * `optimize_data.py`: Minifies JSON keys and groups records to reduce network payload size.
    * `split_cie_data.py`: Segments large data files for efficient browser-side fetching.

## 🚀 Getting Started

### Installation
1.  **Clone the repository:**
    ```bash
    git clone ChessMastermind/moon-papers
    cd moon-papers
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run development server:**
    ```bash
    npm run dev
    ```

### Updating Data
To refresh the exam database:
1.  Update the source files in `developmentfiles/`.
2.  Run the extraction script: `python extract_data.py`.
3.  Run the optimization and splitting script: `python optimize_data.py`.

## 📜 License
This project is for educational purposes. By using Moon Papers, you acknowledge that the site acts as an index and does not host copyrighted materials directly.
