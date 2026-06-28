"use client";

/**
 * PrintView.tsx
 *
 * Two-column print layout:
 *  LEFT  — Template picker, metadata controls, HTML editor, row selector
 *  RIGHT — Live sandboxed iframe preview + print button with pre-flight check
 *
 * Key UX contracts:
 *  - Preview updates reactively (useMemo + 150ms debounce) as the user types
 *  - Pre-flight scans for .print-error spans before calling window.print()
 *  - Mobile < 900px shows a blocking message (print is desktop-only)
 *  - A4/Letter dimensions rendered in mm for WYSIWYPT
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  Printer,
  FileDown,
  FileUp,
  Plus,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Save,
  Monitor,
  FileText,
  Tag,
  BarChart3,
  Award,
  Columns,
} from "lucide-react";
import type { ImportedSheet } from "@/components/SpreadsheetGrid";
import type { BulkSelectionMode, PageSize, PageOrientation, TemplateType } from "@/types/print";
import { usePrintTemplates } from "@/hooks/usePrintTemplates";
import { buildPrintDocument, type RenderError } from "@/utils/printEngine";

// ── Type icons ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<TemplateType, React.ReactNode> = {
  invoice: <FileText size={14} />,
  certificate: <Award size={14} />,
  label: <Tag size={14} />,
  summary: <BarChart3 size={14} />,
  custom: <Columns size={14} />,
};

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PrintViewProps {
  activeSheet: ImportedSheet | null;
  filteredRowIndices?: number[];
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PrintView({ activeSheet, filteredRowIndices }: PrintViewProps) {
  const {
    templates,
    activeTemplate,
    setActiveTemplateId,
    updateActiveHtml,
    updateActiveMetadata,
    createTemplate,
    duplicateActive,
    deleteTemplate,
    exportTemplate,
    importTemplate,
    syncToDb,
    isSyncing,
    syncError,
  } = usePrintTemplates();

  // ── Local state ─────────────────────────────────────────────────────────

  const [bulkMode, setBulkMode] = useState<BulkSelectionMode>("filter");
  const [manualSelected, setManualSelected] = useState<Set<number>>(new Set());
  const [showPreFlight, setShowPreFlight] = useState(false);
  const [preFightErrors, setPreFlightErrors] = useState<RenderError[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Responsive detection ──────────────────────────────────────────────────

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Row selection for bulk mode ────────────────────────────────────────────

  const grid = activeSheet?.data ?? [];
  const dataRowIndices = useMemo(
    () => grid.slice(1).map((_, i) => i + 1),
    [grid]
  );

  const effectiveRowIndices: number[] = useMemo(() => {
    if (!activeTemplate) return [];
    if (bulkMode === "filter") {
      return filteredRowIndices && filteredRowIndices.length > 0
        ? filteredRowIndices
        : dataRowIndices;
    }
    return Array.from(manualSelected).sort((a, b) => a - b);
  }, [bulkMode, filteredRowIndices, dataRowIndices, manualSelected, activeTemplate]);

  // ── Debounced preview computation ─────────────────────────────────────────

  const debouncedHtml = useDebounce(activeTemplate?.bodyHtml ?? "", 150);

  const { previewHtml, renderErrors } = useMemo<{
    previewHtml: string;
    renderErrors: RenderError[];
  }>(() => {
    if (!activeTemplate || grid.length === 0) {
      return { previewHtml: "<html><body></body></html>", renderErrors: [] };
    }

    // In summary mode we pass no row indices (resolves against full grid)
    const rowsForRender = activeTemplate.type === "summary" ? undefined : effectiveRowIndices;

    const { html, errors } = buildPrintDocument(
      { ...activeTemplate, bodyHtml: debouncedHtml },
      grid,
      rowsForRender
    );

    return { previewHtml: html, renderErrors: errors };
  }, [debouncedHtml, grid, effectiveRowIndices, activeTemplate]);

  // ── Sync iframe srcDoc ────────────────────────────────────────────────────

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = previewHtml;
    }
  }, [previewHtml]);

  // ── Pre-flight check & print trigger ─────────────────────────────────────

  const handlePrintClick = useCallback(() => {
    if (renderErrors.length > 0) {
      setPreFlightErrors(renderErrors);
      setShowPreFlight(true);
    } else {
      triggerPrint();
    }
  }, [renderErrors]);

  const triggerPrint = useCallback(() => {
    setShowPreFlight(false);
    const iframeWin = iframeRef.current?.contentWindow;
    if (!iframeWin) return;
    // Small delay to ensure iframe has finished rendering after srcDoc update
    setTimeout(() => iframeWin.print(), 100);
  }, []);

  // ── Import handler ────────────────────────────────────────────────────────

  const handleFileImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await importTemplate(file);
      } catch (err) {
        console.error("[PrintView] Import failed:", err);
      } finally {
        // Reset file input so the same file can be re-imported if needed
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [importTemplate]
  );

  // ── Manual checkbox helpers ────────────────────────────────────────────────

  const toggleRowSelection = useCallback((rowIdx: number) => {
    setManualSelected((prev) => {
      const next = new Set(prev);
      next.has(rowIdx) ? next.delete(rowIdx) : next.add(rowIdx);
      return next;
    });
  }, []);

  const selectAllRows = useCallback(() => {
    setManualSelected(new Set(dataRowIndices));
  }, [dataRowIndices]);

  const deselectAllRows = useCallback(() => {
    setManualSelected(new Set());
  }, []);

  // ── Mobile guard ──────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={styles.mobileGuard}>
        <Monitor size={40} style={{ color: "var(--at-text-muted)", marginBottom: 16 }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--at-text)" }}>
          Print Editor Requires a Wider Screen
        </h3>
        <p style={{ fontSize: 13, color: "var(--at-text-soft)", maxWidth: 320, textAlign: "center" }}>
          The print template editor is optimized for desktop use (≥ 900px) to provide
          an accurate page-size preview. Please open this on a larger screen.
        </p>
      </div>
    );
  }

  // ── No sheet guard ────────────────────────────────────────────────────────

  if (!activeSheet) {
    return (
      <div style={styles.mobileGuard}>
        <FileText size={40} style={{ color: "var(--at-text-muted)", marginBottom: 16 }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Sheet Loaded</h3>
        <p style={{ fontSize: 13, color: "var(--at-text-soft)" }}>
          Import a spreadsheet to use the Print feature.
        </p>
      </div>
    );
  }

  const isPreset = activeTemplate
    ? activeTemplate.id.startsWith("preset-")
    : false;

  const headers = grid[0]?.map((c) => c.value ?? "") ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div style={styles.leftPanel}>

        {/* Template Picker */}
        <div style={styles.section}>
          <button
            style={styles.pickerToggle}
            onClick={() => setTemplatePickerOpen((o) => !o)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {activeTemplate ? TYPE_ICONS[activeTemplate.type] : <FileText size={14} />}
              <span style={styles.pickerLabel}>
                {activeTemplate?.name ?? "Select a template"}
              </span>
            </span>
            {templatePickerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {templatePickerOpen && (
            <div style={styles.templateList}>
              {templates.map((t) => (
                <button
                  key={t.id}
                  style={{
                    ...styles.templateItem,
                    ...(t.id === activeTemplate?.id ? styles.templateItemActive : {}),
                  }}
                  onClick={() => {
                    setActiveTemplateId(t.id);
                    setTemplatePickerOpen(false);
                  }}
                >
                  {TYPE_ICONS[t.type]}
                  <span style={{ flex: 1, textAlign: "left", fontSize: 12 }}>{t.name}</span>
                  {t.id.startsWith("preset-") && (
                    <span style={styles.presetBadge}>preset</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Template actions */}
          <div style={styles.actionRow}>
            <button style={styles.iconBtn} title="New template" onClick={() => createTemplate()}>
              <Plus size={13} />
            </button>
            <button style={styles.iconBtn} title="Duplicate" onClick={duplicateActive}>
              <Copy size={13} />
            </button>
            <button
              style={styles.iconBtn}
              title="Export template as JSON"
              onClick={() => activeTemplate && exportTemplate(activeTemplate.id)}
            >
              <FileDown size={13} />
            </button>
            <button
              style={styles.iconBtn}
              title="Import template from JSON"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp size={13} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleFileImport}
            />
            {!isPreset && (
              <button
                style={{ ...styles.iconBtn, color: "#dc2626" }}
                title="Delete template"
                onClick={() => activeTemplate && deleteTemplate(activeTemplate.id)}
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              style={{ ...styles.iconBtn, marginLeft: "auto" }}
              title="Sync to cloud DB"
              onClick={syncToDb}
              disabled={isSyncing}
            >
              <Save size={13} />
            </button>
          </div>
          {syncError && (
            <p style={{ color: "#dc2626", fontSize: 11, padding: "4px 0" }}>
              Sync failed: {syncError}
            </p>
          )}
        </div>

        {/* Metadata: Name, Page size, Orientation */}
        {activeTemplate && (
          <div style={styles.section}>
            <label style={styles.fieldLabel}>Template Name</label>
            <input
              style={styles.input}
              value={activeTemplate.name}
              disabled={isPreset}
              onChange={(e) => updateActiveMetadata({ name: e.target.value })}
              placeholder="Template name"
            />

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.fieldLabel}>Page Size</label>
                <select
                  style={styles.select}
                  value={activeTemplate.pageSize}
                  disabled={isPreset}
                  onChange={(e) =>
                    updateActiveMetadata({ pageSize: e.target.value as PageSize })
                  }
                >
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="Letter">Letter (216 × 279 mm)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.fieldLabel}>Orientation</label>
                <select
                  style={styles.select}
                  value={activeTemplate.pageOrientation}
                  disabled={isPreset}
                  onChange={(e) =>
                    updateActiveMetadata({ pageOrientation: e.target.value as PageOrientation })
                  }
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Mode Selector */}
        <div style={styles.section}>
          <label style={styles.fieldLabel}>Print Mode</label>
          <div style={styles.modeToggle}>
            <button
              style={{ ...styles.modeBtn, ...(bulkMode === "filter" ? styles.modeBtnActive : {}) }}
              onClick={() => setBulkMode("filter")}
            >
              Filter Result ({filteredRowIndices?.length ?? dataRowIndices.length} rows)
            </button>
            <button
              style={{ ...styles.modeBtn, ...(bulkMode === "manual" ? styles.modeBtnActive : {}) }}
              onClick={() => setBulkMode("manual")}
            >
              Manual Select
            </button>
          </div>

          {bulkMode === "manual" && (
            <div style={styles.rowPicker}>
              <div style={styles.rowPickerActions}>
                <button style={styles.rowPickerBtn} onClick={selectAllRows}>Select All</button>
                <button style={styles.rowPickerBtn} onClick={deselectAllRows}>Deselect All</button>
                <span style={styles.rowCount}>{manualSelected.size} selected</span>
              </div>
              <div style={styles.rowList}>
                {dataRowIndices.map((rowIdx) => {
                  const label = grid[rowIdx]?.[0]?.value || `Row ${rowIdx + 1}`;
                  return (
                    <label key={rowIdx} style={styles.rowCheckLabel}>
                      <input
                        type="checkbox"
                        checked={manualSelected.has(rowIdx)}
                        onChange={() => toggleRowSelection(rowIdx)}
                        style={{ marginRight: 6 }}
                      />
                      <span style={{ fontSize: 11, color: "var(--at-text)" }}>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Available Variables reference */}
        {headers.length > 0 && (
          <div style={styles.section}>
            <label style={styles.fieldLabel}>Available Variables</label>
            <div style={styles.varGrid}>
              {headers.slice(0, 12).map((h, i) => (
                <span key={i} style={styles.varChip} title={`Column index ${i}`}>
                  {`{{${h || `col:${i}`}}}`}
                </span>
              ))}
              {headers.length > 12 && (
                <span style={{ ...styles.varChip, color: "var(--at-text-muted)" }}>
                  +{headers.length - 12} more
                </span>
              )}
            </div>
            <p style={styles.hint}>
              Use <code style={styles.code}>{`{{col:N}}`}</code> for column by index, or{" "}
              <code style={styles.code}>{`{{SUM(B2:B50)}}`}</code> for formulas.
            </p>
          </div>
        )}

        {/* HTML Editor */}
        <div style={{ ...styles.section, flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={styles.fieldLabel}>Template HTML</label>
            {isPreset && (
              <span style={styles.presetNotice}>
                ✏️ Editing will create a custom copy
              </span>
            )}
          </div>
          <textarea
            style={styles.editor}
            value={activeTemplate?.bodyHtml ?? ""}
            onChange={(e) => updateActiveHtml(e.target.value)}
            spellCheck={false}
            placeholder="Enter your template HTML here…"
          />
        </div>
      </div>

      {/* ── RIGHT PANEL — LIVE PREVIEW ─────────────────────────────── */}
      <div style={styles.rightPanel}>
        {/* Preview Header */}
        <div style={styles.previewHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={styles.previewTitle}>Live Preview</span>
            {renderErrors.length > 0 ? (
              <span style={styles.errorBadge}>
                <AlertTriangle size={11} /> {renderErrors.length} error{renderErrors.length > 1 ? "s" : ""}
              </span>
            ) : grid.length > 0 ? (
              <span style={styles.okBadge}>
                <CheckCircle2 size={11} /> Ready
              </span>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={styles.browserHint}>
              💡 Best PDF quality in Chrome/Edge → Save as PDF
            </span>
            <button
              style={styles.printBtn}
              onClick={handlePrintClick}
              disabled={grid.length === 0}
            >
              <Printer size={14} />
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* Error list strip */}
        {renderErrors.length > 0 && (
          <div style={styles.errorStrip}>
            {renderErrors.slice(0, 3).map((e, i) => (
              <span key={i} style={styles.errorItem}>
                <code style={styles.errorCode}>{e.error}</code> in{" "}
                <code style={styles.errorCode}>{e.original}</code>
                {e.rowIndex !== undefined && ` (row ${e.rowIndex + 1})`}
                {e.detail && ` — ${e.detail}`}
              </span>
            ))}
            {renderErrors.length > 3 && (
              <span style={{ color: "var(--at-text-muted)", fontSize: 11 }}>
                +{renderErrors.length - 3} more errors
              </span>
            )}
          </div>
        )}

        {/* iframe Preview */}
        <div style={styles.iframeWrap}>
          <iframe
            ref={iframeRef}
            style={styles.iframe}
            sandbox="allow-same-origin"
            title="Print Preview"
          />
        </div>
      </div>

      {/* ── PRE-FLIGHT MODAL ─────────────────────────────────────────── */}
      {showPreFlight && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={20} color="#f59e0b" />
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Formula Errors Detected</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--at-text-soft)", marginBottom: 12 }}>
              {preFightErrors.length} formula error{preFightErrors.length > 1 ? "s were" : " was"} found in
              the template. These will appear as error codes in the printed document.
            </p>
            <div style={styles.errorScrollList}>
              {preFightErrors.map((e, i) => (
                <div key={i} style={styles.preFlightItem}>
                  <code style={styles.errorCode}>{e.error}</code>
                  <span style={{ fontSize: 11, color: "var(--at-text-soft)" }}>
                    {e.original}
                    {e.rowIndex !== undefined ? ` — row ${e.rowIndex + 1}` : ""}
                    {e.detail ? ` — ${e.detail}` : ""}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button
                style={styles.modalBtnSecondary}
                onClick={() => setShowPreFlight(false)}
              >
                Go Back and Fix
              </button>
              <button style={styles.modalBtnPrimary} onClick={triggerPrint}>
                <Printer size={13} /> Print Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles (inline to keep CSS print isolation) ───────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    height: "100%",
    width: "100%",
    overflow: "hidden",
    background: "var(--at-surface-2)",
    fontFamily: "var(--font-body)",
  },
  leftPanel: {
    width: 320,
    minWidth: 280,
    maxWidth: 360,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--at-border)",
    background: "var(--at-surface)",
    overflowY: "auto",
    gap: 0,
  },
  rightPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  section: {
    padding: "12px 14px",
    borderBottom: "1px solid var(--at-border-light)",
  },
  fieldLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--at-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 5,
  },
  input: {
    width: "100%",
    padding: "6px 8px",
    fontSize: 12.5,
    border: "1px solid var(--at-border)",
    borderRadius: 6,
    background: "var(--at-surface-2)",
    color: "var(--at-text)",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "5px 8px",
    fontSize: 12,
    border: "1px solid var(--at-border)",
    borderRadius: 6,
    background: "var(--at-surface-2)",
    color: "var(--at-text)",
  },
  editor: {
    flex: 1,
    minHeight: 200,
    fontFamily: "'Fira Code', 'Cascadia Code', monospace",
    fontSize: 11.5,
    lineHeight: 1.6,
    padding: "8px 10px",
    border: "1px solid var(--at-border)",
    borderRadius: 6,
    background: "#0f172a",
    color: "#e2e8f0",
    resize: "none",
    outline: "none",
    width: "100%",
  },
  pickerToggle: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    border: "1px solid var(--at-border)",
    borderRadius: 8,
    background: "var(--at-surface-2)",
    cursor: "pointer",
    fontSize: 12.5,
    color: "var(--at-text)",
    gap: 6,
  },
  pickerLabel: {
    fontWeight: 600,
    fontSize: 12.5,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 180,
  },
  templateList: {
    marginTop: 4,
    border: "1px solid var(--at-border)",
    borderRadius: 8,
    background: "var(--at-surface)",
    overflow: "hidden",
    maxHeight: 220,
    overflowY: "auto",
  },
  templateItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    width: "100%",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--at-text)",
    borderBottom: "1px solid var(--at-border-light)",
  },
  templateItemActive: {
    background: "var(--at-surface-2)",
    color: "var(--at-accent)",
    fontWeight: 600,
  },
  presetBadge: {
    fontSize: 9,
    padding: "1px 5px",
    borderRadius: 10,
    background: "var(--at-surface-2)",
    color: "var(--at-text-muted)",
    border: "1px solid var(--at-border)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  presetNotice: {
    fontSize: 10,
    color: "#92400e",
    background: "#fef3c7",
    padding: "2px 7px",
    borderRadius: 4,
  },
  actionRow: {
    display: "flex",
    gap: 4,
    marginTop: 8,
    alignItems: "center",
  },
  iconBtn: {
    background: "var(--at-surface-2)",
    border: "1px solid var(--at-border)",
    borderRadius: 6,
    padding: "5px 7px",
    cursor: "pointer",
    color: "var(--at-text-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modeToggle: {
    display: "flex",
    borderRadius: 8,
    border: "1px solid var(--at-border)",
    overflow: "hidden",
  },
  modeBtn: {
    flex: 1,
    padding: "6px 8px",
    fontSize: 11,
    background: "var(--at-surface-2)",
    border: "none",
    cursor: "pointer",
    color: "var(--at-text-soft)",
    fontWeight: 500,
  },
  modeBtnActive: {
    background: "var(--at-accent)",
    color: "white",
    fontWeight: 600,
  },
  rowPicker: {
    marginTop: 8,
    border: "1px solid var(--at-border)",
    borderRadius: 8,
    overflow: "hidden",
    background: "var(--at-surface-2)",
  },
  rowPickerActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 8px",
    borderBottom: "1px solid var(--at-border-light)",
    background: "var(--at-surface)",
  },
  rowPickerBtn: {
    fontSize: 10,
    padding: "2px 7px",
    border: "1px solid var(--at-border)",
    borderRadius: 4,
    background: "var(--at-surface-2)",
    cursor: "pointer",
    color: "var(--at-text-soft)",
  },
  rowCount: {
    fontSize: 10,
    color: "var(--at-text-muted)",
    marginLeft: "auto",
  },
  rowList: {
    maxHeight: 160,
    overflowY: "auto",
    padding: "4px 0",
  },
  rowCheckLabel: {
    display: "flex",
    alignItems: "center",
    padding: "4px 10px",
    cursor: "pointer",
  },
  varGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  varChip: {
    fontSize: 10,
    fontFamily: "monospace",
    padding: "2px 6px",
    borderRadius: 4,
    background: "var(--at-surface-2)",
    border: "1px solid var(--at-border)",
    color: "var(--at-accent)",
    cursor: "default",
  },
  hint: {
    fontSize: 10.5,
    color: "var(--at-text-muted)",
    lineHeight: 1.5,
  },
  code: {
    fontFamily: "monospace",
    fontSize: 10.5,
    background: "var(--at-surface-2)",
    padding: "1px 4px",
    borderRadius: 3,
    border: "1px solid var(--at-border)",
  },
  previewHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px",
    borderBottom: "1px solid var(--at-border)",
    background: "var(--at-surface)",
    gap: 12,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--at-text)",
  },
  errorBadge: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10.5,
    color: "#dc2626",
    background: "#fee2e2",
    padding: "2px 7px",
    borderRadius: 10,
    fontWeight: 600,
  },
  okBadge: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10.5,
    color: "#16a34a",
    background: "#dcfce7",
    padding: "2px 7px",
    borderRadius: 10,
    fontWeight: 600,
  },
  browserHint: {
    fontSize: 10.5,
    color: "var(--at-text-muted)",
    fontStyle: "italic",
  },
  printBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    background: "var(--at-accent)",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  errorStrip: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    padding: "6px 14px",
    background: "#fff7f7",
    borderBottom: "1px solid #fca5a5",
    fontSize: 11,
  },
  errorItem: {
    color: "#7f1d1d",
    display: "flex",
    gap: 5,
    alignItems: "center",
    flexWrap: "wrap",
  },
  errorCode: {
    fontFamily: "monospace",
    background: "#fee2e2",
    padding: "0 4px",
    borderRadius: 3,
    fontSize: 10.5,
    color: "#dc2626",
  },
  iframeWrap: {
    flex: 1,
    overflow: "auto",
    padding: "16px",
    background: "#e5e7eb",
  },
  iframe: {
    width: "100%",
    height: "100%",
    border: "none",
    background: "white",
  },
  mobileGuard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: 32,
    color: "var(--at-text)",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "var(--at-surface)",
    borderRadius: 12,
    padding: 24,
    maxWidth: 480,
    width: "90%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  errorScrollList: {
    maxHeight: 180,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "6px 0",
  },
  preFlightItem: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "6px 8px",
    background: "#fff7f7",
    borderRadius: 6,
    border: "1px solid #fca5a5",
  },
  modalBtnSecondary: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid var(--at-border)",
    background: "var(--at-surface-2)",
    color: "var(--at-text)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  modalBtnPrimary: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "var(--at-accent)",
    color: "white",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
};
