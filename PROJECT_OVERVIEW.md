# Sheet Manager - Project Overview & Code Structure

This document provides a comprehensive analysis of the code structure, features, external API integrations, and developer learnings for the **Sheet Manager** application.

---

## 1. 🏗️ Code Structure & Architecture

The application is built on **Next.js (App Router)** with **TypeScript**, **React 19**, and **Tailwind CSS**. Below is a map of the codebase:

```
sheet-manager/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── db/
│   │   │       └── route.ts         # Serverless database API with Upstash Redis & local fallbacks
│   │   ├── globals.css              # Global styles, Tailwind definitions, custom console drawer styles
│   │   ├── layout.tsx               # App layout shell
│   │   └── page.tsx                 # Main entry page mounting the SheetManager
│   │
│   ├── components/
│   │   ├── SheetManager.tsx         # Main wizard coordinator & trigger interceptor orchestrator
│   │   ├── SpreadsheetGrid.tsx      # Local grid spreadsheet interface with selection & inline edits
│   │   ├── CellControlPanel.tsx     # Toolbar/sidebar for cell styling, rows/cols actions, & text cleanups
│   │   ├── TriggersConsole.tsx      # Drawer component for trigger rule manager & Change Log viewer
│   │   ├── RightSidebar.tsx         # Layout helper sidebar
│   │   ├── Stepper.tsx              # Wizard navigation indicator
│   │   │
│   │   ├── steps/                   # Individual Wizard Steps (1-4)
│   │   │   ├── CreateSheet.tsx      # Step 1: OAuth Sign-in & Google Sheet initialization
│   │   │   ├── HideTabs.tsx         # Step 2: Tab configuration (show/hide worksheets)
│   │   │   ├── ShareSheet.tsx       # Step 3: Setting file sharing permissions & link generation
│   │   │   └── CertificateMerge.tsx # Step 4: Google Docs template mail merge & Gmail dispatcher
│   │   │
│   │   └── ui/                      # Lightweight reusable UI controls
│   │       ├── Button.tsx
│   │       ├── CollapsibleSection.tsx
│   │       ├── Dropdown.tsx
│   │       └── Toast.tsx
│   │
│   └── hooks/
│       └── useSheetsApi.ts          # Core React hook containing all client-side Google API REST requests
```

### Key File Roles
*   **[useSheetsApi.ts](file:///d:/shekhar-freelance/sheet-manager/src/hooks/useSheetsApi.ts):** Encapsulates GIS Google Identity Services authentication and standardizes authorization headers across Drive, Sheets, Docs, and Gmail REST endpoints.
*   **[SheetManager.tsx](file:///d:/shekhar-freelance/sheet-manager/src/components/SheetManager.tsx):** Coordinates spreadsheet grid state and hosts the trigger interception middleware that detects diffs between changes.
*   **[route.ts](file:///d:/shekhar-freelance/sheet-manager/src/app/api/db/route.ts):** Operates as a serverless database layer using a fallback logic (`Upstash REST API -> Local JSON Filesystem -> In-Memory Cache`) to guarantee persistence across production and development environments.

---

## 2. 🌟 Feature Breakdown

The application is structured as a wizard guiding the user through a local-to-cloud spreadsheet pipeline:

1.  **Local-First Spreadsheet Editor:**
    *   Imports local spreadsheet formats (`.xlsx`, `.xls`, `.csv`, `.tsv`) using SheetJS.
    *   Interactive grid UI for selection, cell styling (alignment, font weight/italics/underlines), and structural modifications (inserting/deleting rows & columns).
    *   One-click text cleanup pipelines (removing trailing/multiple spaces, modifying letter casing).
2.  **Google Sheets Synchronization:**
    *   Instantly exports the local grid into a multi-tab Google Sheet in the user's cloud account.
    *   Step-by-step visibility configurations to hide specific worksheets from view-only links.
    *   One-click Google Drive sharing setup to retrieve a public view-only sharing link.
3.  **Reactive Automation Triggers:**
    *   Trigger-action scheduler checking for spreadsheet events (e.g., `Cell Changed` or `Row Added`).
    *   Allows creating custom triggers, e.g., auto-filling a target column with dynamic row tokens `ID-{{row}}` or auto-generating timestamps.
    *   Developer Change Log drawer illustrating live manual audits and trigger executions.
4.  **Certificate Mail Merge Workflow (Step 4):**
    *   Combines spreadsheet records with Google Docs template files.
    *   Clones templates, fills variable placeholders (e.g. `{Name}`, `{Rank}`), saves them publicly in Google Drive, logs URLs back into the spreadsheet grid, and dispatches custom notification emails via the Gmail API.

---

## 3. 🔌 External API Integrations

The project integrates with the following external HTTP REST APIs:

| External API | Target Service / Scope | Purpose in Application |
| :--- | :--- | :--- |
| **Google Sheets API v4** | `https://sheets.googleapis.com` | Batch updates cells, writes generated document links back to the sheet, modifies sheet configurations, and controls row/column visibility. |
| **Google Drive API v3** | `https://www.googleapis.com/drive` | Creates clones of Google Doc templates, updates file titles, and alters sharing permissions to make files public. |
| **Google Docs API v1** | `https://docs.googleapis.com` | Conducts batch replace operations on template files to insert personalized text. |
| **Gmail API v1** | `https://gmail.googleapis.com` | Constructs and sends personalized emails directly from the user's authenticated Google Account. |
| **Google Identity Services (GIS)**| `https://accounts.google.com` | Client-side OAuth2 flow handling token generation and permission consent popups. |
| **Upstash Redis API** | KV Rest API endpoints | Persistent cloud database storage used by the API route to hold logs, rules, and spreadsheet configurations. |

---

## 4. 🎓 Key Developer Learnings

Building this application demonstrates and reinforces several key full-stack software development patterns:

*   **OAuth2 Consent & Multi-Scope Lifecycle Management:** Implementing client-side OAuth token retrieval and using those transient credentials to build authorized HTTP request streams across multiple discrete service scopes.
*   **Grid Modification Interceptors & Diffing:** Tracking changes by comparing "before" and "after" state snapshots in React, detecting exact indices of added rows and modified cells to kick off trigger tasks.
*   **Prevention of Execution Cascades:** Using state locks (`isExecutingTriggersRef`) to avoid infinite loops when trigger routines write data back to cells that could trigger subsequent events.
*   **Adaptive Serverless Fallbacks:** Designing APIs that dynamically adapt to their environment variables, allowing local database persistence (`fs`) during offline testing and switching to Redis APIs in production.
*   **Document Rendering & Email Serialization:** Constructing RFC 5322 MIME email bodies client-side and encoding them in base64url format for secure transit over HTTP endpoints.
