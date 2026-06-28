/**
 * formulaEvaluator.ts
 *
 * A zero-dependency, zero-eval(), whitelist-based formula & template resolver.
 *
 * SECURITY CONTRACT:
 *  - eval() and new Function() are NEVER called.
 *  - Only functions explicitly listed in SUPPORTED_FUNCTIONS are permitted.
 *  - Only operators in SUPPORTED_OPS are permitted.
 *  - All other tokens yield { ok: false, error: "#UNSUPPORTED" }.
 *
 * SUPPORTED FORMULA SYNTAX inside {{ ... }} blocks:
 *  - Cell references:         A1, B3, Z99
 *  - Range aggregates:        SUM(A1:A10), AVERAGE(B2:B5), COUNT(C1:C20),
 *                             MIN(D1:D5), MAX(D1:D5), COUNTA(A1:A10)
 *  - Row-relative columns:    col:0, col:3  (uses rowContext if provided)
 *  - Header name references:  {Name}, {Email}  (resolved from header row, rowContext)
 *  - Plain arithmetic:        SUM(A1:A5) * 1.18, (A1 + A2) / 2
 *  - Numeric literals:        42, 3.14, -7
 */

import type { CellData } from "@/components/SpreadsheetGrid";
import type { FormulaError, FormulaResult } from "@/types/print";

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPPORTED_FUNCTIONS = [
  "SUM",
  "AVERAGE",
  "AVG",
  "COUNT",
  "COUNTA",
  "MIN",
  "MAX",
] as const;

type SupportedFunction = (typeof SUPPORTED_FUNCTIONS)[number];

const SUPPORTED_OPS = ["+", "-", "*", "/"] as const;

// ── Helpers: Cell/Range Coordinate Resolution ─────────────────────────────────

/**
 * Converts a spreadsheet column label (A, B, ..., Z, AA, ...) to a 0-based index.
 * e.g. "A" → 0, "B" → 1, "Z" → 25, "AA" → 26
 */
function colLabelToIndex(label: string): number {
  let result = 0;
  for (const ch of label.toUpperCase()) {
    result = result * 26 + (ch.charCodeAt(0) - 64);
  }
  return result - 1;
}

/**
 * Parses a cell reference string like "A1" into { row, col } (both 0-based).
 * Returns null if the string is not a valid cell reference.
 */
function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;
  const col = colLabelToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1; // 1-based in notation → 0-based
  return { row, col };
}

/**
 * Resolves a single cell reference against the grid.
 * Returns FormulaResult.
 */
function resolveCell(
  ref: string,
  grid: CellData[][]
): FormulaResult {
  const coords = parseCellRef(ref);
  if (!coords) return { ok: false, error: "#PARSE", detail: `Invalid cell ref: ${ref}` };

  const { row, col } = coords;
  if (row < 0 || row >= grid.length || col < 0 || col >= (grid[0]?.length ?? 0)) {
    return { ok: false, error: "#REF!", detail: `${ref} is out of grid bounds` };
  }

  const value = grid[row]?.[col]?.value ?? "";
  return { ok: true, value };
}

/**
 * Resolves all cells in a range (e.g., "A2:C5") into an array of string values.
 * Returns FormulaResult with an error if bounds are violated.
 */
function resolveRange(
  rangeStr: string,
  grid: CellData[][]
): { ok: true; values: string[] } | { ok: false; error: FormulaError; detail?: string } {
  const parts = rangeStr.split(":");
  if (parts.length !== 2) {
    return { ok: false, error: "#PARSE", detail: `Invalid range: ${rangeStr}` };
  }

  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);

  if (!start || !end) {
    return { ok: false, error: "#PARSE", detail: `Invalid range endpoints in: ${rangeStr}` };
  }

  const maxRow = grid.length - 1;
  const maxCol = (grid[0]?.length ?? 1) - 1;

  if (
    start.row < 0 || start.col < 0 ||
    end.row > maxRow || end.col > maxCol ||
    start.row > end.row || start.col > end.col
  ) {
    return { ok: false, error: "#REF!", detail: `Range ${rangeStr} out of bounds` };
  }

  const values: string[] = [];
  for (let r = start.row; r <= end.row; r++) {
    for (let c = start.col; c <= end.col; c++) {
      values.push(grid[r]?.[c]?.value ?? "");
    }
  }

  return { ok: true, values };
}

// ── Aggregate Functions ───────────────────────────────────────────────────────

function applyAggregate(
  fn: SupportedFunction,
  rangeStr: string,
  grid: CellData[][]
): FormulaResult {
  const resolved = resolveRange(rangeStr, grid);
  if (!resolved.ok) return resolved;

  const { values } = resolved;

  // COUNTA counts non-empty cells (including text)
  if (fn === "COUNTA") {
    return { ok: true, value: values.filter((v) => v.trim() !== "").length };
  }

  // COUNT counts only numeric cells
  if (fn === "COUNT") {
    return { ok: true, value: values.filter((v) => v.trim() !== "" && !isNaN(Number(v))).length };
  }

  // All other functions require at least some numeric values
  const numerics = values
    .filter((v) => v.trim() !== "" && !isNaN(Number(v)))
    .map(Number);

  if (fn === "SUM") {
    return { ok: true, value: numerics.reduce((a, b) => a + b, 0) };
  }

  if (fn === "AVERAGE" || fn === "AVG") {
    if (numerics.length === 0) return { ok: false, error: "#EMPTY", detail: `No numeric values in ${rangeStr}` };
    return { ok: true, value: numerics.reduce((a, b) => a + b, 0) / numerics.length };
  }

  if (fn === "MIN") {
    if (numerics.length === 0) return { ok: false, error: "#EMPTY", detail: `No numeric values in ${rangeStr}` };
    return { ok: true, value: Math.min(...numerics) };
  }

  if (fn === "MAX") {
    if (numerics.length === 0) return { ok: false, error: "#EMPTY", detail: `No numeric values in ${rangeStr}` };
    return { ok: true, value: Math.max(...numerics) };
  }

  return { ok: false, error: "#UNSUPPORTED", detail: `Unknown aggregate: ${fn}` };
}

// ── Arithmetic Evaluator (Recursive Descent, NO eval()) ──────────────────────

/**
 * Tokenizes an arithmetic expression into a flat array of typed tokens.
 * Handles: numbers, +, -, *, /, (, )
 * Everything else is rejected with #UNSUPPORTED.
 */
type ArithToken =
  | { type: "num"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenizeArith(expr: string): ArithToken[] | null {
  const tokens: ArithToken[] = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    const ch = s[i];

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Number (including decimals and leading minus handled by unary)
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
      const parsed = parseFloat(num);
      if (isNaN(parsed)) return null;
      tokens.push({ type: "num", value: parsed });
      continue;
    }

    if (SUPPORTED_OPS.includes(ch as (typeof SUPPORTED_OPS)[number])) {
      tokens.push({ type: "op", value: ch as "+" | "-" | "*" | "/" });
      i++;
      continue;
    }

    if (ch === "(") { tokens.push({ type: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen" }); i++; continue; }

    // Any other character is not permitted
    return null;
  }

  return tokens;
}

/**
 * Recursive descent parser — evaluates an arithmetic expression token stream.
 * Grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := '(' expr ')' | number | unary_minus factor
 */
function parseArith(tokens: ArithToken[]): FormulaResult {
  let pos = 0;

  function peek(): ArithToken | null { return tokens[pos] ?? null; }
  function consume(): ArithToken { return tokens[pos++]; }

  function parseExpr(): number | FormulaError {
    let left = parseTerm();
    if (typeof left === "string") return left;

    while (pos < tokens.length) {
      const t = peek();
      if (t?.type !== "op" || (t.value !== "+" && t.value !== "-")) break;
      consume();
      const right = parseTerm();
      if (typeof right === "string") return right;
      left = t.value === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number | FormulaError {
    let left = parseFactor();
    if (typeof left === "string") return left;

    while (pos < tokens.length) {
      const t = peek();
      if (t?.type !== "op" || (t.value !== "*" && t.value !== "/")) break;
      consume();
      const right = parseFactor();
      if (typeof right === "string") return right;
      if (t.value === "/" && right === 0) return "#DIV/0!";
      left = t.value === "*" ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number | FormulaError {
    const t = peek();
    if (!t) return "#PARSE" as FormulaError;

    // Unary minus
    if (t.type === "op" && t.value === "-") {
      consume();
      const f = parseFactor();
      if (typeof f === "string") return f;
      return -f;
    }

    if (t.type === "lparen") {
      consume(); // consume '('
      const inner = parseExpr();
      if (typeof inner === "string") return inner;
      const closing = peek();
      if (closing?.type !== "rparen") return "#PARSE" as FormulaError;
      consume(); // consume ')'
      return inner;
    }

    if (t.type === "num") {
      consume();
      return t.value;
    }

    return "#UNSUPPORTED" as FormulaError;
  }

  const result = parseExpr();
  if (typeof result === "string") return { ok: false, error: result as FormulaError };
  if (pos !== tokens.length) return { ok: false, error: "#PARSE", detail: "Unexpected tokens at end of expression" };
  return { ok: true, value: result };
}

// ── Expression Pre-processor ──────────────────────────────────────────────────

/**
 * Evaluates a single expression token (the content inside {{ }}).
 *
 * Evaluation priority:
 *  1. Named aggregate:    SUM(A1:A10), AVERAGE(B2:B5), etc.
 *  2. Cell reference:     A1, B3
 *  3. col:N reference:    col:0, col:2  (uses rowContext)
 *  4. Numeric arithmetic: numbers + SUPPORTED_OPS + parentheses only
 *
 * Everything else → #UNSUPPORTED
 */
export function evaluateExpression(
  raw: string,
  grid: CellData[][],
  rowContext?: number
): FormulaResult {
  const expr = raw.trim();

  // 1. Named aggregate: FUNCTIONNAME(range)
  const fnMatch = expr.match(/^([A-Z]+)\(([^)]+)\)$/i);
  if (fnMatch) {
    const fnName = fnMatch[1].toUpperCase();
    const rangeArg = fnMatch[2].trim();

    if (!SUPPORTED_FUNCTIONS.includes(fnName as SupportedFunction)) {
      return { ok: false, error: "#UNSUPPORTED", detail: `Function ${fnName} is not supported` };
    }
    return applyAggregate(fnName as SupportedFunction, rangeArg, grid);
  }

  // 2. Plain cell reference: A1, Z99
  if (/^[A-Za-z]+\d+$/.test(expr)) {
    return resolveCell(expr, grid);
  }

  // 3. Row-relative column index: col:0, col:3
  const colMatch = expr.match(/^col:(\d+)$/i);
  if (colMatch) {
    const col = parseInt(colMatch[1], 10);
    if (rowContext === undefined) {
      return { ok: false, error: "#REF!", detail: "col: reference used outside row context" };
    }
    if (rowContext < 0 || rowContext >= grid.length || col < 0 || col >= (grid[0]?.length ?? 0)) {
      return { ok: false, error: "#REF!", detail: `col:${col} at row ${rowContext} is out of bounds` };
    }
    return { ok: true, value: grid[rowContext][col]?.value ?? "" };
  }

  // 4. Arithmetic — pre-process: substitute any embedded cell refs first
  // Pattern: replace A1-style references with their numeric values before parsing
  const withCellsResolved = expr.replace(/\b([A-Za-z]+)(\d+)\b/g, (match) => {
    const result = resolveCell(match, grid);
    if (!result.ok) return "NaN"; // will be caught as #VALUE!
    const num = Number(result.value);
    return isNaN(num) ? "NaN" : String(num);
  });

  if (withCellsResolved.includes("NaN")) {
    return { ok: false, error: "#VALUE!", detail: "A cell referenced in arithmetic contains non-numeric data" };
  }

  const tokens = tokenizeArith(withCellsResolved);
  if (!tokens) {
    return { ok: false, error: "#UNSUPPORTED", detail: `Cannot tokenize expression: ${expr}` };
  }

  return parseArith(tokens);
}

// ── Template Resolver ─────────────────────────────────────────────────────────

export interface ResolvedToken {
  original: string;   // The raw {{ ... }} block
  result: FormulaResult;
}

/**
 * Resolves all {{ ... }} tokens in a template HTML string.
 *
 * For header-name placeholders like {{Name}}, {{Email}}:
 *  - The first row of the grid is treated as headers.
 *  - The value is looked up from the specified rowContext row.
 *
 * Returns:
 *  - resolvedHtml: the template string with tokens replaced
 *  - errors: all formula errors encountered (for pre-flight check)
 */
export function resolveTemplate(
  templateHtml: string,
  grid: CellData[][],
  rowContext?: number
): { resolvedHtml: string; errors: ResolvedToken[] } {
  const errors: ResolvedToken[] = [];

  // Build header name → col index map (row 0 is always the header row)
  const headerMap: Record<string, number> = {};
  if (grid.length > 0) {
    grid[0].forEach((cell, idx) => {
      const name = cell.value?.trim();
      if (name) headerMap[name] = idx;
    });
  }

  const resolvedHtml = templateHtml.replace(/\{\{([^}]+)\}\}/g, (match, inner: string) => {
    const expr = inner.trim();

    // Header name shorthand: {{Name}} → grid[rowContext][headerMap["Name"]]
    if (rowContext !== undefined && expr in headerMap) {
      const col = headerMap[expr];
      const value = grid[rowContext]?.[col]?.value ?? "";
      return escapeHtml(String(value));
    }

    const result = evaluateExpression(expr, grid, rowContext);

    if (!result.ok) {
      errors.push({ original: match, result });
      return `<span class="print-error" title="${result.detail ?? result.error}">${result.error}</span>`;
    }

    // Format numbers: round to reasonable precision to avoid floating-point artifacts
    if (typeof result.value === "number") {
      const formatted = Number.isInteger(result.value)
        ? String(result.value)
        : result.value.toFixed(2);
      return escapeHtml(formatted);
    }

    return escapeHtml(String(result.value));
  });

  return { resolvedHtml, errors };
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Escapes HTML special characters to prevent XSS from cell values
 * being injected into the rendered template.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
