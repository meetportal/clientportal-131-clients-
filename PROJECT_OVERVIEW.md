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
│   │   │   ├── db/
│   │   │   │   └── route.ts         # Serverless database API with Upstash Redis & local fallbacks
│   │   │   ├── sheets/
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts     # Dynamic JSON API endpoint for worksheets with sorting & security
│   │   │   ├── track/
│   │   │   │   └── route.ts         # Two-purpose tracking API (GET redirect, POST register, DELETE record)
│   │   │   └── webhooks/
│   │   │       ├── dispatch/
│   │   │       │   └── route.ts     # Server-side proxy for outgoing webhook POST dispatches
│   │   │       └── mock-receiver/
│   │   │           └── route.ts     # Local webhook simulator mock-receiver endpoint
│   │   ├── globals.css              # Global styles, Tailwind definitions, custom console drawer styles
│   │   ├── layout.tsx               # App layout shell
│   │   └── page.tsx                 # Main entry page mounting the SheetManager
│   │
│   ├── components/
│   │   ├── SheetManager.tsx         # Main wizard coordinator & trigger interceptor orchestrator
│   │   ├── SpreadsheetGrid.tsx      # Local grid spreadsheet interface with selection & inline edits
│   │   ├── CellControlPanel.tsx     # Toolbar/sidebar for cell styling, rows/cols actions, & text cleanups
│   │   ├── FilterToolbar.tsx        # View switcher, advanced filters dropdown, search & sorting controls
│   │   ├── ClickAnalyticsPanel.tsx  # Dashboard showing CTR%, per-recipient click tracking table & UA details
│   │   ├── TriggersConsole.tsx      # Bottom drawer hosting Change Log, Triggers, Analytics, API, and Webhooks
│   │   ├── RightSidebar.tsx         # Layout helper sidebar
│   │   ├── Stepper.tsx              # Wizard navigation indicator
│   │   │
│   │   ├── steps/                   # Individual Wizard Steps (1-4)
│   │   │   ├── CreateSheet.tsx      # Step 1: OAuth Sign-in & Google Sheet initialization
│   │   │   ├── HideTabs.tsx         # Step 2: Tab configuration (show/hide worksheets)
│   │   │   ├── ShareSheet.tsx       # Step 3: Setting file sharing permissions & link generation
│   │   │   └── CertificateMerge.tsx # Step 4: Google Docs template mail merge, tracking links & Gmail dispatcher
│   │   │
│   │   ├── views/                   # Alternative visual layout representations of spreadsheet data
│   │   │   ├── CalendarView.tsx     # Monthly calendar plotting rows by date column
│   │   │   ├── GalleryView.tsx      # Grid of visual card widgets displaying row fields
│   │   │   ├── KanbanView.tsx       # Drag-and-drop columns grouped by a status column
│   │   │   ├── ListView.tsx         # Compact text list representations
│   │   │   └── PrintView.tsx        # Styled documents ready for browser printing configurations
│   │   │
│   │   └── ui/                      # Lightweight reusable UI controls
│   │       ├── Button.tsx
│   │       ├── CollapsibleSection.tsx
│   │       ├── Dropdown.tsx
│   │       └── Toast.tsx
│   │
│   ├── hooks/
│   │   ├── useFilteredData.ts       # Evaluates active search query, multi-rule filters & sorting
│   │   ├── usePrintTemplates.ts     # Hook managing layouts and custom templates for the Print view
│   │   └── useSheetsApi.ts          # GIS Google Identity Services authentication & REST API requests
│   │
│   ├── types/
│   │   ├── print.ts                 # Print configurations and templates types
│   │   └── tracking.ts              # Type definitions for click tracking events & analytics
│   │
│   └── utils/
│       ├── appUrl.ts                # Canonical base URL resolution and tracking URL builder
│       ├── formulaEvaluator.ts      # Parses dynamic row variables (e.g. ID-{{row}}) for trigger actions
│       └── printEngine.ts           # Helper rendering documents to print
```

### Key File Roles
*   **[useSheetsApi.ts](file:///d:/shekhar-freelance/sheet-manager/src/hooks/useSheetsApi.ts):** Encapsulates GIS Google Identity Services authentication and standardizes authorization headers across Drive, Sheets, Docs, and Gmail REST endpoints.
*   **[SheetManager.tsx](file:///d:/shekhar-freelance/sheet-manager/src/components/SheetManager.tsx):** Coordinates spreadsheet grid state and hosts the trigger interception middleware that detects diffs between changes.
*   **[route.ts](file:///d:/shekhar-freelance/sheet-manager/src/app/api/db/route.ts):** Operates as a serverless database layer using a fallback logic (`Upstash REST API -> Local JSON Filesystem -> In-Memory Cache`) to guarantee persistence across production and development environments.
*   **[useFilteredData.ts](file:///d:/shekhar-freelance/sheet-manager/src/hooks/useFilteredData.ts):** Evaluates multi-rule conditions client-side on the current active sheet, supporting categories like text, numbers, dates, and special rules.

---

## 2. 🌟 Feature Breakdown

The application is structured as a wizard guiding the user through a local-to-cloud spreadsheet pipeline:

1.  **Local-First Spreadsheet Editor:**
    *   Imports local spreadsheet formats (`.xlsx`, `.xls`, `.csv`, `.tsv`) using SheetJS.
    *   Interactive grid UI for selection, cell styling (alignment, font weight/italics/underlines), and structural modifications (inserting/deleting rows & columns).
    *   One-click text cleanup pipelines (removing trailing/multiple spaces, modifying letter casing).
2.  **Airtable-style Views & Advanced Querying:**
    *   Provides 6 visual layouts: Grid, Kanban (grouped by a selected status column), Gallery (displaying rows as visual cards), List (compact rows), Calendar (plotted by date), and Print (custom print layouts).
    *   Search filter bar for instant keyword queries across the current sheet.
    *   Multi-rule filters supporting logic gates (AND/OR) and operators:
        *   *Text:* contains, starts with, ends with, is empty, is not empty.
        *   *Number:* `=`, `>`, `<`, `>=`, `<=`, `between`.
        *   *Date:* is, is before, is after.
        *   *Special:* Regex matching, character length limits, duplicate detector, and cell background color.
    *   Multi-column sorting rules to sort rows dynamically in ascending/descending order.
3.  **Google Sheets Synchronization:**
    *   Instantly exports the local grid into a multi-tab Google Sheet in the user's cloud account.
    *   Step-by-step visibility configurations to hide specific worksheets from view-only links.
    *   One-click Google Drive sharing setup to retrieve a public view-only sharing link.
4.  **Reactive Automation Triggers:**
    *   Trigger-action scheduler checking for spreadsheet events (e.g., `Cell Changed` or `Row Added`).
    *   Allows creating custom triggers, e.g., auto-filling a target column with dynamic row tokens `ID-{{row}}` (parsed and evaluated by `formulaEvaluator.ts`) or auto-generating timestamps.
    *   Developer Change Log drawer illustrating live manual audits and trigger executions.
5.  **Certificate Mail Merge Workflow (Step 4):**
    *   Combines spreadsheet records with Google Docs template files.
    *   Clones templates, fills variable placeholders (e.g. `{Name}`, `{Rank}`, `{Class}`), saves them publicly in Google Drive, logs URLs back into the spreadsheet grid, and dispatches custom notification emails via the Gmail API.
6.  **Real-Time Link Tracking & Click Analytics:**
    *   Generates unique, opaque tracking tokens for mail merge links (`generateTrackingToken()`).
    *   Reroutes recipient links through `/api/track` which logs `ClickEvent` metadata (timestamp, user-agent) in the database before redirecting (302) to the actual Google Drive document URL.
    *   Exposes a real-time admin **Click Analytics** dashboard showing overall Click-Through Rate (CTR%), total emails sent/clicked, search/filter capabilities, and expandable browser/device metadata lists.
7.  **Spreadsheet-to-JSON API:**
    *   Serves worksheet data as clean, queryable JSON endpoints.
    *   Supports dynamic filtering (`?col=val`), pagination (`_limit` / `_offset`), and sorting (`_sort` / `_order`).
    *   Includes public access settings or private API key authorization (with built-in API key generation).
8.  **Outgoing Webhooks:**
    *   Triggers real-time outward HTTP POST dispatches to external URLs on cell changes and row additions, containing structural diffs.
    *   Features a built-in webhook simulator with a local mock receiver page to preview payload payloads directly.
    *   Uses server-side proxy handlers to prevent client-side CORS issues.

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
| **Upstash Redis API** | KV Rest API endpoints | Persistent cloud database storage used by the API route to hold logs, rules, tracked links, and spreadsheet configurations. |

---

## 4. 🎓 Key Developer Learnings

Building this application demonstrates and reinforces several key full-stack software development patterns:

*   **OAuth2 Consent & Multi-Scope Lifecycle Management:** Implementing client-side OAuth token retrieval and using those transient credentials to build authorized HTTP request streams across multiple discrete service scopes.
*   **Link Wrapping & Analytics Redirection:** Interacting with an admin dashboard by wrapping asset delivery URLs in an opaque tracking token redirect flow. This allows auditing user engagement (device user-agents, click frequencies) serverless-ly before forwarding requests to third-party CDNs or cloud drives.
*   **Multi-Layout State Synchronization:** Designing an interface that propagates live cell changes, filter configurations, and custom row actions seamlessly across various complex visualizations (Grid, Kanban boards, interactive Calendars, and Galleries).
*   **Prevention of Execution Cascades:** Using state locks (`isExecutingTriggersRef`) to avoid infinite loops when trigger routines write data back to cells that could trigger subsequent events.
*   **Adaptive Serverless Fallbacks:** Designing APIs that dynamically adapt to their environment variables, allowing local database persistence (`fs`) during offline testing and switching to Redis APIs in production.
*   **Document Rendering & Email Serialization:** Constructing RFC 5322 MIME email bodies client-side and encoding them in base64url format for secure transit over HTTP endpoints.
