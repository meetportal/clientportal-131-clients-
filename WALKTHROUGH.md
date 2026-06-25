# Walkthrough: sheet-triggers Branch Feature Additions

This branch (`feat/sheet-triggers`) implements a reactive spreadsheet triggers engine, a developer console UI for managing rules and auditing logs, and a serverless database API backend connecting to Upstash Redis (with local fallback).

---

## 🏗️ Architecture & Changes Overview

The feature is built of three integrated parts:

```
┌────────────────────────────────────────────────────────┐
│                   Spreadsheet Grid                     │
│    (Inline Edits, Sidebar formatting, Row additions)   │
└──────────────────────────┬─────────────────────────────┘
                           │ Intercepts state changes
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Triggers Engine                      │
│     (Checks matching rules, evaluates templates,       │
│      runs side-effects, appends to Change Log)         │
└──────────────────────────┬─────────────────────────────┘
                           │ Syncs state
                           ▼
┌────────────────────────────────────────────────────────┐
│                     Database API                       │
│    (Saves to Upstash Redis or Local scratch file)      │
└────────────────────────────────────────────────────────┘
```

### 1. Database Route
* **File:** [`src/app/api/db/route.ts`](file:///d:/shekhar-freelance/sheet-manager/src/app/api/db/route.ts)
* **Features:**
  - Reads `KV_REST_API_URL` and `KV_REST_API_TOKEN` dynamically from the environment.
  - Automatically serializes and saves database state to **Upstash Redis** using POST body arrays to handle large JSON objects safely.
  - Automatically falls back to a local JSON file (`scratch/sheet_db.json`) during local development if credentials are absent.
  - Exposes `/api/db?test=true` to allow front-end connection tests.

### 2. Triggers Console UI
* **File:** [`src/components/TriggersConsole.tsx`](file:///d:/shekhar-freelance/sheet-manager/src/components/TriggersConsole.tsx)
* **Features:**
  - Collapsible drawer at the bottom of the grid with a dark console interface.
  - **Change Log Tab**: Scrollable history of all manual cell edits, row additions, and trigger runs. Supports searching logs and filtering by event type.
  - **Triggers Manager Tab**: View active trigger rules, toggle their state, delete rules, and configure new triggers via a builder form.
  - **Database Status Indicator**: Shows the active storage provider (e.g., Upstash Redis, Local JSON, or In-Memory) and includes "Test Database Connection" and "Sync Now" buttons.

### 3. Triggers Engine Interceptor
* **File:** [`src/components/SheetManager.tsx`](file:///d:/shekhar-freelance/sheet-manager/src/components/SheetManager.tsx)
* **Features:**
  - Replaced the direct state updates with a custom `handleSheetsChange` interceptor.
  - Compares the previous sheet data structure against the new structure on every change to identify **Row Additions** and **Cell Changes**.
  - Automatically evaluates active rules and executes actions (e.g. `auto_fill` target columns with templated values or `log_only` to the console).
  - Utilizes a `React.useRef` lock (`isExecutingTriggersRef`) to prevent infinite recursion cascades if a trigger modifies the cell that triggers it.

### 4. Stylesheet Additions
* **File:** [`src/app/globals.css`](file:///d:/shekhar-freelance/sheet-manager/src/app/globals.css)
* **Features:**
  - Added CSS classes for the bottom console layout, tabs, badges, custom dark scrollbars, list items, logs grid, and badges.

---

## 🧪 How to Verify & Test

You can test all these features directly in your browser:

### 1. Database Connection Check
* In the bottom console footer, click **Test Database Connection**.
* It will connect to the API route and output a toast notification confirming whether it is using your **Upstash Redis** credentials or local file storage.

### 2. Testing the Cell Changed Trigger
* In the grid, edit a value in Column A (Product) and press Enter.
* The pre-configured trigger **"Auto Timestamp Product Edit"** will immediately run, writing the current timestamp to Column C (Last Modified).
* Open the **Change Log** tab to see the logged manual edit and the subsequent trigger execution.

### 3. Testing the Row Added Trigger
* In the grid, select a row and click **Add Row Below**.
* The trigger **"Log Row Additions"** will execute and log the event.
* Go to the **Triggers Manager** tab and create a new trigger:
  - **Name:** `ID Generator`
  - **Event Type:** `Row Added`
  - **Action:** `Auto-fill another cell in the same row`
  - **Target Write Column:** `Column A`
  - **Value / Template:** `ID-{{row}}`
* Add another row. Column A will automatically populate with `ID-6`, `ID-7` (based on the row index).

### 4. Database Sync
* Make some changes and reload the browser page.
* You will observe that the grid structure, trigger configurations, and change log history are persisted and restored automatically from your Upstash database.
