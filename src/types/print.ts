// ─── Print Feature Type Definitions ─────────────────────────────────────────
// All types used across formulaEvaluator, printEngine, usePrintTemplates, and PrintView.

// ── Page Dimensions ───────────────────────────────────────────────────────────

export const PAGE_DIMENSIONS = {
  A4: { widthMm: 210, heightMm: 297, marginMm: 15 },
  Letter: { widthMm: 215.9, heightMm: 279.4, marginMm: 19.05 },
} as const;

export type PageSize = keyof typeof PAGE_DIMENSIONS;
export type PageOrientation = "portrait" | "landscape";

// ── Template Types ─────────────────────────────────────────────────────────────

export type TemplateType =
  | "invoice"
  | "certificate"
  | "label"
  | "summary"
  | "custom";

export interface PrintTemplate {
  /** Unique ID — generated with crypto.randomUUID() or a timestamp-based fallback */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Preset category for icon/grouping in the picker UI */
  type: TemplateType;
  /** Raw HTML string containing {{ }} placeholder tokens */
  bodyHtml: string;
  /** Physical page size used for both preview and @media print CSS */
  pageSize: PageSize;
  /** Page orientation */
  pageOrientation: PageOrientation;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp — updated on every save */
  updatedAt: string;
}

// ── Formula Evaluation Result ─────────────────────────────────────────────────

/**
 * All error strings match spreadsheet convention so users recognise them
 * without needing to read documentation.
 */
export type FormulaError =
  | "#DIV/0!"      // attempted division by zero
  | "#VALUE!"      // type mismatch — e.g. text where a number was required
  | "#REF!"        // cell or range coordinate is out of grid bounds
  | "#UNSUPPORTED" // function or operator not in the evaluator whitelist
  | "#EMPTY"       // range resolved to zero qualifying cells
  | "#PARSE"       // expression could not be tokenized at all

export type FormulaResult =
  | { ok: true; value: number | string }
  | { ok: false; error: FormulaError; detail?: string }

// ── Bulk Row Selection Modes ──────────────────────────────────────────────────

/** "filter" uses the currently active filter result from SheetManager.
 *  "manual" uses the rowIndices explicitly selected in the PrintView checkbox list. */
export type BulkSelectionMode = "filter" | "manual";

// ── Saved State Shape for /api/db Extension ──────────────────────────────────

/** Shape of the printTemplates field added to the DB route payload */
export interface PrintDbPayload {
  printTemplates: PrintTemplate[];
}
