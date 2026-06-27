"use client";

import { useMemo } from "react";
import { CellData, ImportedSheet } from "@/components/SpreadsheetGrid";

// ─── Filter Operators ─────────────────────────────────────────────────────────

export type TextOperator =
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "regex";

export type NumberOperator =
  | "num_equals"
  | "num_not_equals"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between";

export type DateOperator =
  | "date_is"
  | "date_is_not"
  | "date_before"
  | "date_after"
  | "is_today"
  | "is_this_week"
  | "is_this_month"
  | "within_past_n_days";

export type UniqueOperator =
  | "row_range"          // Show rows between N and M
  | "is_duplicate"       // Show duplicate values in this column
  | "length_gt"          // Cell value length > N chars
  | "length_lt"          // Cell value length < N chars
  | "has_bg_color"       // Cell has a background color
  | "is_checked"         // Value is "true", "yes", "1", "✓"
  | "is_not_checked";    // Value is "false", "no", "0", ""

export type FilterOperator =
  | TextOperator
  | NumberOperator
  | DateOperator
  | UniqueOperator;

export type FilterCategory = "text" | "number" | "date" | "unique";

export interface FilterOperatorMeta {
  value: FilterOperator;
  label: string;
  category: FilterCategory;
  needsValue: boolean;
  needsValue2?: boolean; // for 'between' and 'row_range'
}

export const ALL_FILTER_OPERATORS: FilterOperatorMeta[] = [
  // ── Text ──────────────────────────────────────────────
  { value: "contains",      label: "Contains",           category: "text",   needsValue: true  },
  { value: "not_contains",  label: "Does not contain",   category: "text",   needsValue: true  },
  { value: "equals",        label: "Equals",             category: "text",   needsValue: true  },
  { value: "not_equals",    label: "Not equals",         category: "text",   needsValue: true  },
  { value: "starts_with",   label: "Starts with",        category: "text",   needsValue: true  },
  { value: "ends_with",     label: "Ends with",          category: "text",   needsValue: true  },
  { value: "is_empty",      label: "Is empty",           category: "text",   needsValue: false },
  { value: "is_not_empty",  label: "Is not empty",       category: "text",   needsValue: false },
  { value: "regex",         label: "Matches regex",      category: "text",   needsValue: true  },
  // ── Number ────────────────────────────────────────────
  { value: "num_equals",    label: "= (Equals)",         category: "number", needsValue: true  },
  { value: "num_not_equals",label: "≠ (Not equals)",     category: "number", needsValue: true  },
  { value: "gt",            label: "> (Greater than)",   category: "number", needsValue: true  },
  { value: "gte",           label: "≥ (At least)",       category: "number", needsValue: true  },
  { value: "lt",            label: "< (Less than)",      category: "number", needsValue: true  },
  { value: "lte",           label: "≤ (At most)",        category: "number", needsValue: true  },
  { value: "between",       label: "Between (range)",    category: "number", needsValue: true, needsValue2: true },
  // ── Date ──────────────────────────────────────────────
  { value: "date_is",       label: "Date is",            category: "date",   needsValue: true  },
  { value: "date_is_not",   label: "Date is not",        category: "date",   needsValue: true  },
  { value: "date_before",   label: "Is before",          category: "date",   needsValue: true  },
  { value: "date_after",    label: "Is after",           category: "date",   needsValue: true  },
  { value: "is_today",      label: "Is today",           category: "date",   needsValue: false },
  { value: "is_this_week",  label: "Is this week",       category: "date",   needsValue: false },
  { value: "is_this_month", label: "Is this month",      category: "date",   needsValue: false },
  { value: "within_past_n_days", label: "Within past N days", category: "date", needsValue: true },
  // ── Unique ────────────────────────────────────────────
  { value: "row_range",     label: "Row range (N to M)", category: "unique", needsValue: true, needsValue2: true },
  { value: "is_duplicate",  label: "Is duplicate value", category: "unique", needsValue: false },
  { value: "length_gt",     label: "Length > N chars",   category: "unique", needsValue: true  },
  { value: "length_lt",     label: "Length < N chars",   category: "unique", needsValue: true  },
  { value: "has_bg_color",  label: "Has background color", category: "unique", needsValue: false },
  { value: "is_checked",    label: "Is checked / true",  category: "unique", needsValue: false },
  { value: "is_not_checked",label: "Is unchecked / false", category: "unique", needsValue: false },
];

// ─── FilterRule ───────────────────────────────────────────────────────────────

export interface FilterRule {
  id: string;
  colIndex: number;        // -1 means "all columns" (used for search)
  operator: FilterOperator;
  value: string;
  value2?: string;         // secondary value (between, row_range)
  logic?: "and" | "or";   // how this rule combines with previous (default: and)
}

// ─── SortRule ─────────────────────────────────────────────────────────────────

export interface SortRule {
  id: string;
  colIndex: number;
  direction: "asc" | "desc";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTrueish(val: string): boolean {
  const lower = val.trim().toLowerCase();
  return lower === "true" || lower === "yes" || lower === "1" || lower === "✓" || lower === "checked";
}

function isDateThisWeek(d: Date): boolean {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

function isDateThisMonth(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ─── Single-cell filter evaluation ────────────────────────────────────────────

function evaluateCellFilter(
  cell: CellData,
  op: FilterOperator,
  filterVal: string,
  filterVal2: string | undefined,
): boolean {
  const raw = cell?.value ?? "";
  const lower = raw.toLowerCase();
  const fv = filterVal.toLowerCase().trim();

  switch (op) {
    // Text
    case "contains":      return lower.includes(fv);
    case "not_contains":  return !lower.includes(fv);
    case "equals":        return lower === fv;
    case "not_equals":    return lower !== fv;
    case "starts_with":   return lower.startsWith(fv);
    case "ends_with":     return lower.endsWith(fv);
    case "is_empty":      return raw.trim() === "";
    case "is_not_empty":  return raw.trim() !== "";
    case "regex": {
      try { return new RegExp(filterVal).test(raw); } catch { return false; }
    }
    // Number
    case "num_equals":    { const n = parseFloat(raw); return !isNaN(n) && n === parseFloat(filterVal); }
    case "num_not_equals":{ const n = parseFloat(raw); return !isNaN(n) && n !== parseFloat(filterVal); }
    case "gt":            { const n = parseFloat(raw); return !isNaN(n) && n > parseFloat(filterVal); }
    case "gte":           { const n = parseFloat(raw); return !isNaN(n) && n >= parseFloat(filterVal); }
    case "lt":            { const n = parseFloat(raw); return !isNaN(n) && n < parseFloat(filterVal); }
    case "lte":           { const n = parseFloat(raw); return !isNaN(n) && n <= parseFloat(filterVal); }
    case "between": {
      const n = parseFloat(raw);
      const lo = parseFloat(filterVal);
      const hi = parseFloat(filterVal2 ?? "0");
      return !isNaN(n) && n >= lo && n <= hi;
    }
    // Date
    case "date_is": {
      const d = new Date(raw);
      const f = new Date(filterVal);
      return !isNaN(d.getTime()) && d.toDateString() === f.toDateString();
    }
    case "date_is_not": {
      const d = new Date(raw);
      const f = new Date(filterVal);
      return !isNaN(d.getTime()) && d.toDateString() !== f.toDateString();
    }
    case "date_before": {
      const d = new Date(raw); const f = new Date(filterVal);
      return !isNaN(d.getTime()) && d < f;
    }
    case "date_after": {
      const d = new Date(raw); const f = new Date(filterVal);
      return !isNaN(d.getTime()) && d > f;
    }
    case "is_today": {
      const d = new Date(raw);
      return !isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
    }
    case "is_this_week": {
      const d = new Date(raw);
      return !isNaN(d.getTime()) && isDateThisWeek(d);
    }
    case "is_this_month": {
      const d = new Date(raw);
      return !isNaN(d.getTime()) && isDateThisMonth(d);
    }
    case "within_past_n_days": {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return false;
      const n = parseInt(filterVal, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - n);
      return d >= cutoff && d <= new Date();
    }
    // Unique
    case "length_gt": return raw.length > parseInt(filterVal, 10);
    case "length_lt": return raw.length < parseInt(filterVal, 10);
    case "has_bg_color": return !!(cell?.style?.bg && cell.style.bg !== "");
    case "is_checked":   return isTrueish(raw);
    case "is_not_checked": return !isTrueish(raw);
    // row_range and is_duplicate are handled at the row level
    default: return true;
  }
}

// ─── Row-level filter evaluation ──────────────────────────────────────────────

function evaluateRowFilter(
  rowData: CellData[],
  rowIdx: number,
  rule: FilterRule,
  allColData: CellData[][],   // full column data for duplicate detection
): boolean {
  const { colIndex, operator, value, value2 } = rule;

  // Row range (unique operator — applies to row index, not cell value)
  if (operator === "row_range") {
    const lo = parseInt(value, 10) - 1;       // convert to 0-indexed
    const hi = parseInt(value2 ?? "99999", 10) - 1;
    return rowIdx >= lo && rowIdx <= hi;
  }

  // Duplicate detection
  if (operator === "is_duplicate") {
    const targetVal = rowData[colIndex]?.value?.trim().toLowerCase() ?? "";
    if (targetVal === "") return false;
    const colVals = allColData.map((r) => r[colIndex]?.value?.trim().toLowerCase() ?? "");
    return colVals.filter((v) => v === targetVal).length > 1;
  }

  // Normal per-cell operators
  if (colIndex === -1) {
    // Apply across all columns (search mode)
    return rowData.some((cell) => evaluateCellFilter(cell, operator, value, value2));
  }

  const cell = rowData[colIndex];
  return evaluateCellFilter(cell || { value: "" }, operator, value, value2);
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export interface FilteredDataResult {
  /** Filtered + sorted rows with their original row indices */
  rows: Array<{ originalIdx: number; cells: CellData[] }>;
  /** Total number of rows (excluding header) before filtering */
  totalRows: number;
  /** Number of rows after filtering */
  filteredCount: number;
}

export function useFilteredData(
  sheet: ImportedSheet | null,
  filterRules: FilterRule[],
  sortRules: SortRule[],
  searchTerm: string,
): FilteredDataResult {
  return useMemo(() => {
    if (!sheet || sheet.data.length === 0) {
      return { rows: [], totalRows: 0, filteredCount: 0 };
    }

    const allRows = sheet.data;
    // Row 0 is treated as header — always include it, filter applies to rows 1+
    const headerRow = allRows[0];
    const dataRows = allRows.slice(1);
    const totalRows = dataRows.length;

    // Build indexed rows
    let indexed = dataRows.map((cells, i) => ({ originalIdx: i + 1, cells }));

    // ── Apply filter rules (AND logic between rules by default) ───
    if (filterRules.length > 0) {
      indexed = indexed.filter(({ cells, originalIdx }) => {
        let result = true;
        for (let i = 0; i < filterRules.length; i++) {
          const rule = filterRules[i];
          const ruleResult = evaluateRowFilter(cells, originalIdx - 1, rule, allRows);
          if (i === 0) {
            result = ruleResult;
          } else {
            const logic = rule.logic ?? "and";
            result = logic === "or" ? result || ruleResult : result && ruleResult;
          }
        }
        return result;
      });
    }

    // ── Apply search term (across all cells, case-insensitive) ────
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      indexed = indexed.filter(({ cells }) =>
        cells.some((c) => c?.value?.toLowerCase().includes(term))
      );
    }

    // ── Apply sort rules ──────────────────────────────────────────
    if (sortRules.length > 0) {
      indexed = [...indexed].sort((a, b) => {
        for (const rule of sortRules) {
          const aVal = a.cells[rule.colIndex]?.value ?? "";
          const bVal = b.cells[rule.colIndex]?.value ?? "";
          // Try numeric sort
          const aNum = parseFloat(aVal);
          const bNum = parseFloat(bVal);
          let cmp = 0;
          if (!isNaN(aNum) && !isNaN(bNum)) {
            cmp = aNum - bNum;
          } else {
            cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
          }
          if (cmp !== 0) return rule.direction === "asc" ? cmp : -cmp;
        }
        return 0;
      });
    }

    // Always prepend header at originalIdx=0
    const finalRows = [
      { originalIdx: 0, cells: headerRow },
      ...indexed,
    ];

    return { rows: finalRows, totalRows, filteredCount: indexed.length };
  }, [sheet, filterRules, sortRules, searchTerm]);
}
