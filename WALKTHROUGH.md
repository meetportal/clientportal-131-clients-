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

---

## 🎓 Certificate Generator & Mail Merge (Step 4)

We implemented a client-side document copy, replacement, and email dispatch engine as a new wizard step.

### 1. New Google OAuth Scopes
To support the mail merge workflow, the application requests the following additional Google API scopes when the user clicks **Sign in with Google**:
* `https://www.googleapis.com/auth/drive` — To copy templates and manage sharing settings.
* `https://www.googleapis.com/auth/documents` — To edit the copied Google Docs via template replacements.
* `https://www.googleapis.com/auth/gmail.send` — To send personalized emails from the user's Gmail account.

### 2. Client-Side Google API Integration
* **File:** [`src/hooks/useSheetsApi.ts`](file:///d:/shekhar-freelance/sheet-manager/src/hooks/useSheetsApi.ts)
* **Methods:**
  - `copyTemplateDoc(templateId, name)`: Uses Google Drive API (`POST /drive/v3/files/{templateId}/copy`) to clone a template document.
  - `replaceDocPlaceholders(docId, replacements)`: Uses Google Docs API (`POST /v1/documents/{docId}:batchUpdate`) to find and replace placeholders like `{Name}`, `{Rank}`, and `{Class}`.
  - `makeFilePublic(fileId)`: Uses Google Drive API (`POST /drive/v3/files/{fileId}/permissions`) to grant `anyone` `reader` access, then fetches the `webViewLink`.
  - `writeCellToSheet(spreadsheetId, range, value)`: Writes the generated document URL back to the mapped spreadsheet cell.
  - `sendGmailMessage(to, subject, body)`: Constructs an RFC 5322 MIME message, base64url-encodes it, and sends it via Gmail API (`POST /gmail/v1/users/me/messages/send`).

### 3. Step 4 Wizard UI Panel
* **File:** [`src/components/steps/CertificateMerge.tsx`](file:///d:/shekhar-freelance/sheet-manager/src/components/steps/CertificateMerge.tsx)
* **Features:**
  - **Inputs:** Google Doc template ID, Start Row, and End Row.
  - **Column Mappers:** Direct mapping of placeholders (`{Name}`, `{Rank}`, `{Class}`), recipient email, and target cell column.
  - **Email Subject & Body Editor:** Custom template support with dynamic variable rendering.
  - **Loop Execution Dashboard:** Real-time log displaying progress (Copying doc, Replacing placeholders, Sharing in Drive, Writing to Sheet, Sending email) for each row with success/error status indicators.

---

## 🧪 How to Verify & Test (Step 4)

1. **OAuth Sign-In:**
   - In Step 1, click **Sign In with Google**. Grant all requested permissions (Drive, Documents, Gmail).
2. **Setup Sheet Data:**
   - Add columns for Name, Rank, Class, Email, and Link.
   - Enter test values (e.g. `your-test-email@gmail.com`).
3. **Setup Template:**
   - Create a Google Doc with text like: `Hello {Name}, your rank is {Rank}.`
   - Copy the document ID from the browser URL (the long string between `/d/` and `/edit`).
4. **Run Merge:**
   - Navigate to Step 4. Paste the template ID.
   - Set the row range (e.g., Start: 2, End: 3) and map the columns.
   - Click **Run Certificate Mail Merge**.
   - Monitor the real-time execution log.
5. **Check Results:**
   - Verify the generated document link is written to the target column in the grid.
   - Open your Google Sheet to verify the cell was updated remotely.
   - Check the recipient email inbox to verify the personalized email was received.
