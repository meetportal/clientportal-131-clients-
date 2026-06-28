# Sheet Manager

Sheet Manager is an Airtable-inspired local-first spreadsheet application built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Upstash Redis** (with local JSON fallback). It provides a full-featured spreadsheet editing grid, automated Google Sheet synchronization, automated mail-merge certificate dispatches via Gmail, and developer integration capabilities (JSON APIs and Webhooks).

---

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables (Optional):**
   Create a `.env.local` file in the root directory if you want to use cloud database storage or Google integration backends. By default, the application falls back to a local database file (`scratch/sheet_db.json`) if keys are absent.

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Feature Testing Manual

Below are step-by-step instructions on how to test each and every feature in the application.

---

### 1. Local Spreadsheet Grid Editor
* **Goal:** Test file importing, spreadsheet interactions, structural changes, and text cleanups.
* **How to Test:**
  1. Open the page. In Step 1 (**New Sheet Setup**), choose to use the pre-loaded **Sample Data** or click **Upload Spreadsheet** to import an Excel (`.xlsx`, `.xls`) or CSV file.
  2. Double-click on any cell in the grid to perform an inline edit, then press **Enter** to commit it.
  3. Select a cell, click **Cell Style** in the right sidebar (or toggle cell panel mode), and test applying **Bold**, *Italic*, Underline, or text alignment options.
  4. Select a row/column header. Test clicking **Add Row Below** or **Delete Column** to modify the sheet's structure.
  5. Select a column of text, and test the **Text Cleanup Operations** in the Cell Control Panel:
     - **Trim Casing:** Convert to UPPERCASE, lowercase, or Title Case.
     - **Trim Spaces:** Remove trailing spaces or collapse multiple spaces into one.

---

### 2. Google Sheets Cloud Sync
* **Goal:** Verify OAuth2 authentication and cloud exporting.
* **How to Test:**
  1. In the Step 1 panel, click **Sign in with Google** and complete the OAuth consent popup (requires Drive, Sheets, Docs, and Gmail scopes).
  2. Once signed in, click **Create Google Sheet**. The application will instantly export the grid into a new spreadsheet in your Google Drive.
  3. Click **Open in Google Sheets** to view the live sheet in Google.
  4. Edit cells locally in the app grid, and click the **Save & Sync** button in the bottom console footer. Refresh your Google Sheets browser window to verify the edits synced automatically.

---

### 3. Worksheet Tab Visibility (Step 2)
* **Goal:** Hide specific worksheet tabs in shared view-only environments.
* **How to Test:**
  1. Click **Next Step** to proceed to Step 2 (**Tab Visibility**).
  2. You will see a list of tabs present in the workbook. Click the **Lock / Unlock** toggle icons to configure visibility.
  3. Locked tabs will be marked hidden and hidden from external view-only links.

---

### 4. Google Drive Sharing Link (Step 3)
* **Goal:** Make the Google Sheet shareable and copy the link.
* **How to Test:**
  1. Proceed to Step 3 (**Share**).
  2. Click **Share Sheet**. The app will use the Google Drive API to set file sharing permissions to "Anyone with the link can view".
  3. Copy the generated sharing link. Paste it in an incognito browser window to verify public view-only access.

---

### 5. Certificate Mail Merge & Gmail Dispatcher (Step 4)
* **Goal:** Automate document copies and email dispatches.
* **How to Test:**
  1. Make sure your grid has columns matching the placeholder variables in your template (e.g. `Name`, `Rank`, `Email`).
  2. Proceed to Step 4 (**Certificates**).
  3. Enter the **Google Doc Template ID** (copy it from the URL of any template Google Doc).
  4. Select the columns that map to the recipient names and emails.
  5. Click **Run Mail Merge**. The app will:
     - Copy the template document in Google Drive for each recipient.
     - Replace placeholders (e.g. `{Name}`) with spreadsheet values.
     - Save the new documents and make them public.
     - Automatically send an email to the recipient's address using your Gmail account containing the certificate link.
     - Log the generated document URLs back into your spreadsheet grid.

---

### 6. Advanced Filters, Sorting, and Views
* **Goal:** Test Airtable-style viewing and query logic.
* **How to Test:**
  1. Use the **View Switcher** toolbar located above the grid to switch layouts:
     - **Grid:** Default spreadsheet layout.
     - **Kanban:** Cards grouped by a chosen status column.
     - **Gallery:** Grid tile cards showing each row.
     - **List / Calendar / Print:** Clean compact listings.
  2. Click the **Filter** dropdown, click **Add Filter**, select a column (e.g., Q1 Sales), operator (`>`), and input value (`1000`). Confirm only matching rows are displayed.
  3. Test advanced filters: **Regex matching**, **Length limits**, **Duplicate detectors**, and **Cell Background Color** filters.
  4. Click **Sort**, add a column, select ascending/descending, and confirm the grid rows sort dynamically.

---

### 7. Reactive Automation Triggers
* **Goal:** Run triggered routines on cell edits and row additions.
* **How to Test:**
  1. Expand the bottom console and go to the **Triggers Manager** tab.
  2. A default trigger is configured: *"Auto Timestamp Product Edit"*. Select any cell in Column A (Product), modify its value, and press Enter.
  3. Notice that Column C (Last Modified) is automatically updated with the current timestamp.
  4. Create a new trigger: Event: `Row Added` → Action: `Auto-fill` → Write column: `Column A` → Formula/value: `ID-{{row}}`.
  5. Add a new row below. Column A will automatically populate with `ID-N`.
  6. Switch to the **Change Log** tab in the console drawer to audit the trigger executions.

---

### 8. Spreadsheet-to-JSON API
* **Goal:** Query worksheet data as a JSON endpoint.
* **How to Test:**
  1. Expand the bottom console drawer and click the **JSON API** tab.
  2. Toggle the API status to **API Enabled**.
  3. Copy the **API Endpoint URL** (e.g. `http://localhost:3000/api/sheets/Sheet1`).
  4. Open it in a new browser tab or query it in your terminal:
     - **Public:** `curl -X GET "http://localhost:3000/api/sheets/Sheet1"` (returns the sheet rows as a JSON array).
     - **Private:** Toggle the Access Level to **Private** in the console. Copy the generated API Key. Verify requests without the key fail with `401 Unauthorized`. Run the query with the header:
       ```bash
       curl -X GET "http://localhost:3000/api/sheets/Sheet1" -H "Authorization: Bearer sk_live_YOUR_KEY"
       ```
  5. Test query modifiers:
     - **Filters:** `?colName=value`
     - **Limit:** `?_limit=2`
     - **Sorting:** `?_sort=colName&_order=desc`

---

### 9. Outbound Webhooks & Built-in Simulator
* **Goal:** Send real-time POST payloads to external endpoints on sheet edits and visualize them natively.
* **How to Test:**
  1. Expand the bottom console drawer and click the **Webhooks** tab.
  2. Click the **Use Built-in Simulator** button. The app will automatically configure the local mock receiver endpoint (`http://localhost:3000/api/webhooks/mock-receiver`).
  3. Toggle status to **Webhooks Enabled** and click **Save Settings**.
  4. Click **Send Test Webhook**. You will see the event appear instantly in the **Simulated Deliveries Received** feed in the right-hand panel!
  5. Click **Save & Sync** in the console footer.
  6. Edit any cell in the spreadsheet grid or add a row.
  7. Check the **Simulated Deliveries Received** feed. Verify that a real-time `cell_changed` or `row_added` payload containing the diff (coordinates, old/new value) was successfully captured and displayed.
  8. *Optional:* Paste an external URL (e.g. from `https://webhook.site`) into the URL input and save to test external dispatches.
