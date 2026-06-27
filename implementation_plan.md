# Filter & View System — Implementation Plan

## Background

Sheet Manager is an Airtable-inspired Next.js (App Router) spreadsheet tool. The main spreadsheet work area is the `SpreadsheetGrid` component, embedded inside `SheetManager`. The app uses an Airtable-style shell layout: a **top bar** → **subbar** → **content area** (grid) + collapsible **right sidebar**.

The filters and views feature will be added to work on **any imported spreadsheet**, operating on the live `ImportedSheet[]` data without mutating it — all filtering/view-switching is purely display-layer logic.

---

## Placement Analysis & Architecture Decision

### Where filters go (positioning)

The correct placement (derived from studying Airtable, Notion, and Google Sheets patterns):

```
┌─────────────────────────────────────────────────────────┐
│ TOPBAR  [Logo]  [Steps nav]                  [Actions]  │ ← existing
├─────────────────────────────────────────────────────────┤
│ SUBBAR  [Working on: file.xlsx]              [Step X/4] │ ← existing (only when synced)
├─────────────────────────────────────────────────────────┤
│ TOOLBAR [🗂 Grid ▾] [🔍 Filter ▾] [↕ Sort ▾] [Search ] │ ← NEW: filter/view toolbar
├─────────────────────────────────────────────────────────┤
│                                                         │
│   SPREADSHEET GRID / KANBAN / GALLERY / LIST VIEW       │ ← switches based on view
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The **Filter/View Toolbar** renders only when a spreadsheet is loaded (`importedSheets !== null`) between the subbar and the grid. It is sticky and always visible during grid work.

---

## Feature Breakdown

### 1. View Switcher (View Types)
A dropdown/pill selector that switches the rendering mode of the data:

| View | Description |
|------|-------------|
| **Grid** (default) | Current table/spreadsheet view |
| **Kanban** | Cards grouped by a chosen column (e.g., Status) |
| **Gallery** | Card tiles showing each row as an image/info card |
| **List** | Compact single-column list of rows |
| **Calendar** | Rows plotted on a date grid (by a date column) |

### 2. Filter Panel (column-level data filters)
A dropdown that opens a multi-filter builder panel. Each filter rule has:
- **Column selector** (any column from the header row)
- **Operator selector** (type-aware)
- **Value input**

#### All filter operators included:

**Text operators:**
- `contains` / `does not contain`
- `equals` / `not equals`
- `starts with` / `ends with`
- `is empty` / `is not empty`

**Number operators:**
- `= (equals)` / `≠ (not equals)`
- `> (greater than)` / `>= (greater than or equal)`
- `< (less than)` / `<= (less than or equal)`
- `between` (range)

**Date operators:**
- `is` / `is not`
- `is before` / `is after`
- `is today` / `is this week` / `is this month`
- `is within the past N days`

**Boolean / presence:**
- `is empty` / `is not empty`
- `is checked` / `is not checked`

**Unique/novel filters for this project:**
- **Row number range** — "Show rows 10–50" (great for large sheets)
- **Duplicate detector** — "Show duplicate values in column X"
- **Length filter** — "Value length > N characters"
- **Regex match** — "Matches pattern /…/"
- **Cell has color** — filter by background color applied to a cell

### 3. Sort Rules
A separate dropdown panel for column sorting:
- Column selector
- Direction: Ascending / Descending
- Multi-level sort (sort by A, then by B)

### 4. Search Bar
An inline text search that highlights/filters rows containing a search term across all visible columns.

### 5. Active Filter Chips
When filters/sorts are active, a row of dismissible chips renders below the toolbar showing what's active (e.g., `Status contains Active ×`).

---

## State Architecture

All filter/sort/view/search state lives in `SheetManager.tsx` (the orchestrator), passed as props to the toolbar and then to the view components. No new global state or context needed — follows the existing pattern.

```ts
// New state in SheetManager.tsx
type ViewType = 'grid' | 'kanban' | 'gallery' | 'list' | 'calendar';

interface FilterRule {
  id: string;
  column: string;         // column index or header name
  operator: FilterOperator;
  value: string;
  value2?: string;        // for 'between'
}

interface SortRule {
  id: string;
  column: string;
  direction: 'asc' | 'desc';
}
```

Filtered data is computed via a `useMemo` hook — the grid receives the **derived** (filtered/sorted) rows, not the original data. This means filtering is purely visual and non-destructive.

---

## New Files

### `[NEW]` `src/components/FilterToolbar.tsx`
The subbar-level toolbar containing:
- View switcher dropdown
- Filter dropdown (opens FilterPanel)
- Sort dropdown (opens SortPanel)
- Search input
- Active filter chips

### `[NEW]` `src/components/views/KanbanView.tsx`
Renders data as Kanban cards grouped by a selected column value. Uses CSS grid/flex.

### `[NEW]` `src/components/views/GalleryView.tsx`
Renders each row as a card tile in a responsive masonry-style grid.

### `[NEW]` `src/components/views/ListView.tsx`
Compact stripped list of rows — each row is a single `<div>` with key fields shown.

### `[NEW]` `src/components/views/CalendarView.tsx`
Calendar grid (month view) with rows plotted by a date column.

### `[NEW]` `src/hooks/useFilteredData.ts`
A hook that takes `ImportedSheet`, `FilterRule[]`, `SortRule[]`, and `searchTerm` and returns the filtered/sorted row data with original indices for display.

---

## Modified Files

### `[MODIFY]` [SheetManager.tsx](file:///d:/shekhar-freelance/sheet-manager/src/components/SheetManager.tsx)
- Add `viewType`, `filterRules`, `sortRules`, `searchTerm` state
- Import and render `<FilterToolbar>` between the workbook header and the grid
- Pass `viewType` to choose which view component renders
- Compute filtered data via `useFilteredData` hook and pass to view components

### `[MODIFY]` [SpreadsheetGrid.tsx](file:///d:/shekhar-freelance/sheet-manager/src/components/SpreadsheetGrid.tsx)
- Accept an optional `filteredRowIndices?: number[]` prop
- When provided, only render rows whose original indices are in the filtered set
- This makes the grid "filter-aware" while remaining the source of truth

### `[MODIFY]` [globals.css](file:///d:/shekhar-freelance/sheet-manager/src/app/globals.css)
- Add filter toolbar CSS classes (`.filter-toolbar`, `.filter-chip`, `.view-btn`, etc.)
- Add Kanban, Gallery, List, Calendar view-specific CSS
- Add filter panel dropdown CSS

---

## Verification Plan

### Automated Tests
```bash
npm run type-check   # TypeScript validation
npm run build        # Production build verification
```

### Manual Verification
1. Load a spreadsheet (CSV or XLSX) and confirm the filter toolbar appears.
2. Switch between Grid → Kanban → Gallery → List → Calendar views.
3. Apply a "contains" text filter — rows should reduce live.
4. Apply a numeric "greater than" filter — only matching rows show.
5. Apply a sort (ascending / descending) and verify ordering.
6. Use the search bar — matching rows highlight.
7. Stack multiple filters — all must apply conjunctively (AND logic).
8. Dismiss a filter chip — that filter removes and rows restore.
9. Kanban: choose grouping column — cards group correctly.
10. Calendar: choose a date column — rows appear on correct date cells.
11. Clear all filters — all rows return.
12. Build succeeds with zero TypeScript errors.
