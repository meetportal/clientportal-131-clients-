# Sheet Manager App Context

This file contains contextual information about the Sheet Manager application to guide development and avoid redundant research.

## Purpose & Features
The **Sheet Manager** app is a web application that facilitates a seamless spreadsheet management workflow:
1. **Google Sheets Integration:** Create a Google Sheet, configure sheet tab visibility (hide/show tabs), and generate a shared view-only link.
2. **Local Spreadsheet Editor (Excel/CSV):** Import local spreadsheet files (`.xlsx`, `.xls`, `.csv`, `.tsv`), edit cell values, apply typography and alignment formats, perform text cleanup operations, dynamically insert or delete rows/columns, hide/show specific rows or columns, and export edits to a new Excel file or sync them directly to a Google Sheet.

## Tech Stack
- **Framework:** Next.js (App Router)
- **UI & Logic:** React 19, TypeScript, Tailwind CSS, Lucide React (for icons)
- **Spreadsheet Parsing:** `xlsx` (SheetJS) for local Excel/CSV file parsing and generation
- **APIs & Auth:** Google Identity Services (GIS) with OAuth2 client-side flow, Google Sheets API v4, Google Drive API v3

## Key Components & Files
- [SheetManager.tsx](file:///d:/shekhar-freelance/sheet-manager/src/components/SheetManager.tsx) — Main orchestrator of the app, coordinates the wizard steps, file imports, and sync/export triggers.
- [SpreadsheetGrid.tsx](file:///d:/shekhar-freelance/sheet-manager/src/components/SpreadsheetGrid.tsx) — The local spreadsheet grid component that displays row/column headers, handles selection, inline editing, and renders/manages row & column visibility.
- [CellControlPanel.tsx](file:///d:/shekhar-freelance/sheet-manager/src/components/CellControlPanel.tsx) — The sidebar panel for the grid editor that supports formatting toggles, structural actions, and row/column visibility controls.
- [useSheetsApi.ts](file:///d:/shekhar-freelance/sheet-manager/src/hooks/useSheetsApi.ts) — Hook containing OAuth2 integration and Google Sheets/Drive API fetch calls (e.g. creating sheets, updating tab visibility, updating row/column visibility, and setting permissions).
- [HideTabs.tsx](file:///d:/shekhar-freelance/sheet-manager/src/components/steps/HideTabs.tsx) — Step 2 component for managing Google Sheet tab visibility.
