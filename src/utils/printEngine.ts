/**
 * printEngine.ts
 *
 * Orchestrates template resolution and composes the full printable HTML document
 * that is injected into the sandboxed preview <iframe> via srcDoc.
 *
 * Responsibilities:
 *  - Accept a PrintTemplate + grid + selected row indices
 *  - Resolve the template once (summary mode) or per-row (bulk mode)
 *  - Inject fixed A4/Letter @media print CSS
 *  - Return a complete <html>...</html> string + aggregate error list
 */

import type { CellData } from "@/components/SpreadsheetGrid";
import type { PrintTemplate, FormulaError } from "@/types/print";
import { PAGE_DIMENSIONS } from "@/types/print";
import { resolveTemplate } from "@/utils/formulaEvaluator";

// ── Re-export for consumers ───────────────────────────────────────────────────
export type { FormulaError };

// ── Error collected during rendering ─────────────────────────────────────────

export interface RenderError {
  /** Row index that produced the error (undefined = summary mode) */
  rowIndex?: number;
  /** The raw {{ ... }} token that failed */
  original: string;
  /** Error code */
  error: FormulaError;
  detail?: string;
}

// ── Print CSS ─────────────────────────────────────────────────────────────────

function buildPrintCss(template: PrintTemplate): string {
  const dim = PAGE_DIMENSIONS[template.pageSize];
  const isLandscape = template.pageOrientation === "landscape";

  // Swap width/height when landscape
  const pageW = isLandscape ? dim.heightMm : dim.widthMm;
  const pageH = isLandscape ? dim.widthMm : dim.heightMm;
  const margin = dim.marginMm;

  return `
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Base typography ── */
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: #e5e7eb;
    }

    /* ── Page container (screen) ── */
    .print-page {
      width: ${pageW}mm;
      min-height: ${pageH}mm;
      margin: 0 auto 24px auto;
      padding: ${margin}mm;
      background: #ffffff;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
      position: relative;
    }

    /* ── Formula error spans (screen only) ── */
    .print-error {
      background: #fee2e2;
      color: #dc2626;
      font-family: monospace;
      font-size: 10pt;
      padding: 1px 4px;
      border-radius: 3px;
      border: 1px solid #fca5a5;
      text-decoration: underline dotted #dc2626;
      cursor: help;
    }

    /* ── @media print overrides ── */
    @media print {
      body {
        background: white;
        width: ${pageW}mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* Hide error visual decoration in print output */
      .print-error {
        background: transparent;
        border: none;
        color: #dc2626;
        text-decoration: none;
      }

      .print-page {
        width: ${pageW}mm;
        min-height: ${pageH}mm;
        padding: ${margin}mm;
        margin: 0;
        box-shadow: none;
        page-break-after: always;
        page-break-inside: avoid;
      }

      /* Last page doesn't need a forced break */
      .print-page:last-child {
        page-break-after: auto;
      }

      @page {
        size: ${template.pageSize} ${template.pageOrientation};
        margin: 0;
      }
    }
  `;
}

// ── Document Composer ─────────────────────────────────────────────────────────

/**
 * Builds a full, self-contained HTML document string for use as iframe.srcDoc.
 *
 * Modes:
 *   - selectedRowIndices is empty or undefined → Summary mode: render template once,
 *     cell references evaluate against the full grid.
 *   - selectedRowIndices is non-empty → Bulk mode: render one <div class="print-page">
 *     per row, with row-context resolution ({{Name}}, {{col:0}} etc.)
 */
export function buildPrintDocument(
  template: PrintTemplate,
  grid: CellData[][],
  selectedRowIndices?: number[]
): { html: string; errors: RenderError[] } {
  const allErrors: RenderError[] = [];
  const pages: string[] = [];

  const isBulk = selectedRowIndices && selectedRowIndices.length > 0;

  if (isBulk) {
    // Bulk mode — one page per selected row
    for (const rowIdx of selectedRowIndices!) {
      const { resolvedHtml, errors } = resolveTemplate(
        template.bodyHtml,
        grid,
        rowIdx
      );

      for (const e of errors) {
        if (!e.result.ok) {
          allErrors.push({
            rowIndex: rowIdx,
            original: e.original,
            error: e.result.error,
            detail: e.result.detail,
          });
        }
      }

      pages.push(`<div class="print-page">${resolvedHtml}</div>`);
    }
  } else {
    // Summary mode — render once, no row context
    const { resolvedHtml, errors } = resolveTemplate(template.bodyHtml, grid);

    for (const e of errors) {
      if (!e.result.ok) {
        allErrors.push({
          original: e.original,
          error: e.result.error,
          detail: e.result.detail,
        });
      }
    }

    pages.push(`<div class="print-page">${resolvedHtml}</div>`);
  }

  const css = buildPrintCss(template);
  const bodyContent = pages.join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeAttr(template.name)}</title>
  <style>${css}</style>
</head>
<body>
${bodyContent}
</body>
</html>`;

  return { html, errors: allErrors };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Built-in Preset Templates ─────────────────────────────────────────────────
// These provide a starting point so users immediately see something useful
// when they first open the Print view.

export const PRESET_TEMPLATES: Omit<PrintTemplate, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Invoice",
    type: "invoice",
    pageSize: "A4",
    pageOrientation: "portrait",
    bodyHtml: `<div style="font-family: Arial, sans-serif; color: #1a1a1a;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">
    <div>
      <h1 style="font-size: 28pt; color: #1e40af; margin-bottom: 4px;">INVOICE</h1>
      <p style="color: #6b7280; font-size: 10pt;">Date: {{col:0}}</p>
    </div>
    <div style="text-align: right;">
      <p style="font-size: 11pt; font-weight: 600;">Invoice #: {{col:1}}</p>
    </div>
  </div>

  <div style="margin-bottom: 24px;">
    <p style="font-size: 10pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Bill To</p>
    <p style="font-size: 13pt; font-weight: 600;">{{col:2}}</p>
    <p style="font-size: 10pt; color: #374151;">{{col:3}}</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 10pt;">
    <thead>
      <tr style="background: #1e40af; color: white;">
        <th style="padding: 8px 12px; text-align: left;">Description</th>
        <th style="padding: 8px 12px; text-align: right;">Qty</th>
        <th style="padding: 8px 12px; text-align: right;">Unit Price</th>
        <th style="padding: 8px 12px; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 12px;">{{col:4}}</td>
        <td style="padding: 8px 12px; text-align: right;">{{col:5}}</td>
        <td style="padding: 8px 12px; text-align: right;">{{col:6}}</td>
        <td style="padding: 8px 12px; text-align: right; font-weight: 600;">{{col:7}}</td>
      </tr>
    </tbody>
  </table>

  <div style="text-align: right; margin-top: 16px;">
    <p style="font-size: 12pt; font-weight: 700; color: #1e40af;">Total: {{col:7}}</p>
  </div>

  <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 9pt; text-align: center;">
    Thank you for your business.
  </div>
</div>`,
  },
  {
    name: "Certificate of Completion",
    type: "certificate",
    pageSize: "A4",
    pageOrientation: "landscape",
    bodyHtml: `<div style="text-align: center; padding: 40px; border: 8px solid #1e40af; min-height: 180mm; display: flex; flex-direction: column; justify-content: center; font-family: Georgia, serif;">
  <p style="font-size: 11pt; color: #6b7280; letter-spacing: 0.1em; text-transform: uppercase;">This Certificate is Awarded to</p>
  <h1 style="font-size: 36pt; color: #1e40af; margin: 16px 0; font-weight: bold;">{{col:0}}</h1>
  <p style="font-size: 13pt; color: #374151; margin-bottom: 8px;">For successfully completing</p>
  <p style="font-size: 18pt; font-weight: 600; color: #1f2937; margin-bottom: 24px;">{{col:1}}</p>
  <p style="font-size: 10pt; color: #9ca3af;">Awarded on {{col:2}}</p>
</div>`,
  },
  {
    name: "Mailing Label",
    type: "label",
    pageSize: "Letter",
    pageOrientation: "portrait",
    bodyHtml: `<div style="font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6;">
  <p style="font-weight: 700; font-size: 13pt;">{{col:0}}</p>
  <p>{{col:1}}</p>
  <p>{{col:2}}, {{col:3}}</p>
  <p>{{col:4}}</p>
</div>`,
  },
  {
    name: "Data Summary Report",
    type: "summary",
    pageSize: "A4",
    pageOrientation: "portrait",
    bodyHtml: `<div style="font-family: Arial, sans-serif; color: #1a1a1a;">
  <h1 style="font-size: 20pt; color: #1e40af; margin-bottom: 4px; border-bottom: 2px solid #1e40af; padding-bottom: 8px;">Data Summary Report</h1>
  <p style="color: #6b7280; font-size: 10pt; margin-bottom: 32px;">Generated from spreadsheet data</p>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
    <div style="background: #eff6ff; border-radius: 8px; padding: 16px; border-left: 4px solid #1e40af;">
      <p style="font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Total Rows</p>
      <p style="font-size: 22pt; font-weight: 700; color: #1e40af;">{{COUNT(A2:A1000)}}</p>
    </div>
    <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; border-left: 4px solid #16a34a;">
      <p style="font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Sum (Column B)</p>
      <p style="font-size: 22pt; font-weight: 700; color: #16a34a;">{{SUM(B2:B1000)}}</p>
    </div>
    <div style="background: #fefce8; border-radius: 8px; padding: 16px; border-left: 4px solid #ca8a04;">
      <p style="font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Average (Column B)</p>
      <p style="font-size: 22pt; font-weight: 700; color: #ca8a04;">{{AVERAGE(B2:B1000)}}</p>
    </div>
    <div style="background: #fdf4ff; border-radius: 8px; padding: 16px; border-left: 4px solid #9333ea;">
      <p style="font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Max (Column B)</p>
      <p style="font-size: 22pt; font-weight: 700; color: #9333ea;">{{MAX(B2:B1000)}}</p>
    </div>
  </div>
</div>`,
  },
];
