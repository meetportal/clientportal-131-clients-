"use client";

import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Play,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
} from "lucide-react";
import { ImportedSheet, CellData, getColLabel } from "./SpreadsheetGrid";

// ── Types ──────────────────────────────────────────────────────────────────────

interface KVPair {
  id: string;
  key: string;
  value: string;
}

interface RunResult {
  rowIdx: number;
  status?: number;
  data?: unknown;
  error?: string;
  ms?: number;
}

export interface HttpApiPanelProps {
  sheets: ImportedSheet[];
  activeSheetIdx: number;
  selectedCell: { row: number; col: number };
  onSheetsChange: (sheets: ImportedSheet[]) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function newKV(): KVPair {
  return { id: uid(), key: "", value: "" };
}

function colLabelToIdx(label: string): number {
  const upper = label.toUpperCase();
  let idx = 0;
  for (let i = 0; i < upper.length; i++) {
    idx = idx * 26 + (upper.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function interpolateRow(template: string, rowData: CellData[]): string {
  return template.replace(/\{\{([A-Za-z]+)\}\}/g, (_, label) => {
    const idx = colLabelToIdx(label);
    return rowData[idx]?.value ?? "";
  });
}

function buildFinalUrl(endpoint: string, params: KVPair[], rowData: CellData[]): string {
  const base = interpolateRow(endpoint, rowData);
  const valid = params.filter((kv) => kv.key.trim());
  if (!valid.length) return base;
  const qs = valid
    .map(
      (kv) =>
        `${encodeURIComponent(interpolateRow(kv.key, rowData))}=${encodeURIComponent(interpolateRow(kv.value, rowData))}`,
    )
    .join("&");
  return base.includes("?") ? `${base}&${qs}` : `${base}?${qs}`;
}

function extractValue(data: unknown, responseKeys: string): string {
  if (data === undefined || data === null) return "";
  const keys = responseKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (!keys.length) return typeof data === "string" ? data : JSON.stringify(data, null, 2);
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (keys.length === 1) {
      const v = obj[keys[0]];
      return v !== undefined ? String(v) : "";
    }
    const subset: Record<string, unknown> = {};
    keys.forEach((k) => {
      if (k in obj) subset[k] = obj[k];
    });
    return JSON.stringify(subset);
  }
  return String(data);
}

// ── Shared input style ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 9px",
  border: "1px solid var(--at-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "12px",
  color: "var(--at-text)",
  background: "var(--at-surface)",
  outline: "none",
  fontFamily: "var(--font-body)",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease",
};

// ── Toggle switch ──────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        border: "none",
        background: checked ? "var(--at-accent)" : "#d1d5db",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s ease",
        padding: 0,
        flexShrink: 0,
      }}
      aria-checked={checked}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: checked ? "18px" : "2px",
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          display: "block",
        }}
      />
    </button>
  );
}

// ── Collapsible sub-section ────────────────────────────────────────────────────

function SubSection({
  label,
  optional = true,
  defaultOpen = false,
  children,
}: {
  label: string;
  optional?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid var(--at-border-light)", paddingTop: "10px" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        <ChevronRight
          size={11}
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.18s ease",
            color: "var(--at-text-muted)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--at-text)" }}>{label}</span>
        {optional && (
          <span style={{ fontSize: "11px", color: "var(--at-text-soft)", fontWeight: 400 }}>
            — Optional
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            paddingTop: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Key-value pair editor ──────────────────────────────────────────────────────

function KVEditor({
  pairs,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Enter value...",
  colHint,
}: {
  pairs: KVPair[];
  onChange: (pairs: KVPair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  colHint?: string;
}) {
  const update = (id: string, field: "key" | "value", val: string) =>
    onChange(pairs.map((kv) => (kv.id === id ? { ...kv, [field]: val } : kv)));
  const remove = (id: string) => onChange(pairs.filter((kv) => kv.id !== id));
  const add = () => onChange([...pairs, newKV()]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {pairs.map((kv, i) => (
        <div key={kv.id} style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          <input
            type="text"
            value={kv.key}
            onChange={(e) => update(kv.id, "key", e.target.value)}
            placeholder={`${keyPlaceholder} (${i + 1})`}
            style={{ ...inputStyle, flex: 1 }}
          />
          <div style={{ flex: 1.4, display: "flex", flexDirection: "column", gap: "2px" }}>
            <input
              type="text"
              value={kv.value}
              onChange={(e) => update(kv.id, "value", e.target.value)}
              placeholder={valuePlaceholder}
              style={inputStyle}
            />
            {colHint && i === 0 && (
              <span
                style={{ fontSize: "9.5px", color: "var(--at-text-soft)", fontStyle: "italic" }}
              >
                {colHint}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => remove(kv.id)}
            style={{
              background: "none",
              border: "none",
              padding: "5px",
              cursor: "pointer",
              color: "var(--at-text-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--clr-error)";
              e.currentTarget.style.background = "var(--clr-error-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--at-text-soft)";
              e.currentTarget.style.background = "none";
            }}
            title="Remove"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 10px",
          border: "1px dashed var(--at-border)",
          borderRadius: "var(--radius-sm)",
          background: "transparent",
          color: "var(--at-text-muted)",
          fontSize: "11px",
          fontWeight: 500,
          cursor: "pointer",
          width: "100%",
          justifyContent: "center",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--at-accent)";
          e.currentTarget.style.color = "var(--at-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--at-border)";
          e.currentTarget.style.color = "var(--at-text-muted)";
        }}
      >
        <Plus size={12} />
        Add a new Key and Value pair
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const HTTP_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"];

const METHOD_COLORS: Record<string, { bg: string; color: string }> = {
  GET:     { bg: "#dcfce7", color: "#16a34a" },
  POST:    { bg: "#dbeafe", color: "#2563eb" },
  PUT:     { bg: "#fef9c3", color: "#b45309" },
  PATCH:   { bg: "#fef9c3", color: "#b45309" },
  DELETE:  { bg: "#fee2e2", color: "#dc2626" },
  HEAD:    { bg: "#f3f4f6", color: "#374151" },
  OPTIONS: { bg: "#f3f4f6", color: "#374151" },
};

export function HttpApiPanel({
  sheets,
  activeSheetIdx,
  selectedCell,
  onSheetsChange,
}: HttpApiPanelProps) {
  // Config
  const [method, setMethod] = useState("GET");
  const [showMethodDd, setShowMethodDd] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [queryParams, setQueryParams] = useState<KVPair[]>([newKV(), newKV()]);
  const [body, setBody] = useState("");
  const [reqHeaders, setReqHeaders] = useState<KVPair[]>([newKV()]);
  const [responseKeys, setResponseKeys] = useState("");
  const [removeEmpty, setRemoveEmpty] = useState(true);
  const [returnMeta, setReturnMeta] = useState(false);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [maxRedirects, setMaxRedirects] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("");
  const [resultCol, setResultCol] = useState("");

  // Run state
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<{ done: number; total: number } | null>(null);
  const [runResults, setRunResults] = useState<RunResult[] | null>(null);

  const currentSheet = sheets[activeSheetIdx];
  const headerRow = currentSheet?.data[0] || [];
  const colCount = headerRow.length;
  const colLabels = Array.from({ length: colCount }, (_, i) => getColLabel(i));
  const colHint =
    colLabels.length > 0
      ? `Use {{${colLabels[0]}}}, {{${colLabels[1] ?? "B"}}} for row values`
      : "Use {{A}}, {{B}} for column values";

  const isValid = endpoint.trim() !== "";

  // ── Execute one row ──────────────────────────────────────────────────────────

  const execRequest = async (rowData: CellData[], rowIdx: number): Promise<RunResult> => {
    const t0 = Date.now();
    try {
      const url = buildFinalUrl(endpoint, queryParams, rowData);

      const hdrs: Record<string, string> = {};
      reqHeaders
        .filter((h) => h.key.trim())
        .forEach((h) => {
          hdrs[interpolateRow(h.key, rowData)] = interpolateRow(h.value, rowData);
        });

      let reqBody: string | undefined;
      if (body.trim() && method !== "GET" && method !== "HEAD") {
        reqBody = interpolateRow(body, rowData);
      }

      const res = await fetch("/api/http-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          method,
          headers: hdrs,
          body: reqBody,
          followRedirects,
          timeout: timeoutMs ? parseInt(timeoutMs) : 30000,
        }),
      });

      const json = await res.json();
      return { rowIdx, status: json.status ?? res.status, data: json.data, ms: Date.now() - t0 };
    } catch (e) {
      return {
        rowIdx,
        error: e instanceof Error ? e.message : "Request failed",
        ms: Date.now() - t0,
      };
    }
  };

  // ── Write results into sheet data ────────────────────────────────────────────

  const writeResults = (results: RunResult[], srcSheets: ImportedSheet[]): ImportedSheet[] => {
    const next = srcSheets.map((s) => ({
      ...s,
      cols: s.cols ? s.cols.map((c) => ({ ...c })) : undefined,
      rows: s.rows ? s.rows.map((r) => ({ ...r })) : undefined,
      data: s.data.map((r) => r.map((c) => ({ ...c }))),
    }));

    const sheet = { ...next[activeSheetIdx] };
    const data = sheet.data.map((r) => [...r]);
    let colIdx: number;

    if (resultCol.trim()) {
      colIdx = colLabelToIdx(resultCol.trim().toUpperCase());
    } else {
      // Append a new "API Result" column
      colIdx = data[0]?.length ?? 0;
      data[0] = [...(data[0] || []), { value: "API Result", style: { bold: true } }];
      for (let r = 1; r < data.length; r++) {
        data[r] = [...(data[r] || []), { value: "", style: {} }];
      }
      const existingCols = sheet.cols || [];
      const newCols = existingCols.slice();
      while (newCols.length < colIdx) newCols.push({ hidden: false });
      newCols.push({ hidden: false });
      sheet.cols = newCols;
    }

    results.forEach(({ rowIdx, data: respData, error, status, ms }) => {
      if (!data[rowIdx]) return;

      let value: string;
      if (error) {
        value = `Error: ${error}`;
      } else if (returnMeta) {
        value = JSON.stringify({ status, data: respData, ms });
      } else {
        value = extractValue(respData, responseKeys);
        if (removeEmpty && !value) return;
      }

      while (data[rowIdx].length <= colIdx) data[rowIdx].push({ value: "", style: {} });
      data[rowIdx][colIdx] = { ...data[rowIdx][colIdx], value };
    });

    sheet.data = data;
    next[activeSheetIdx] = sheet;
    return next;
  };

  // ── Run on rows ──────────────────────────────────────────────────────────────

  const runOn = async (rowIndices: number[]) => {
    if (!isValid || isRunning || rowIndices.length === 0) return;
    setIsRunning(true);
    setRunResults(null);
    setRunProgress({ done: 0, total: rowIndices.length });

    const srcSheets = sheets;
    const results: RunResult[] = [];

    for (let i = 0; i < rowIndices.length; i++) {
      const rowIdx = rowIndices[i];
      const rowData = srcSheets[activeSheetIdx]?.data[rowIdx] || [];
      const r = await execRequest(rowData, rowIdx);
      results.push(r);
      setRunProgress({ done: i + 1, total: rowIndices.length });
    }

    const updated = writeResults(results, srcSheets);
    onSheetsChange(updated);
    setRunResults(results);
    setIsRunning(false);
    setRunProgress(null);
  };

  const handleRunCurrentRow = () => runOn([selectedCell.row]);

  const handleRunAllRows = () => {
    const rowCount = currentSheet?.data.length || 0;
    const indices: number[] = [];
    for (let r = 1; r < rowCount; r++) {
      if (!currentSheet?.rows?.[r]?.hidden) indices.push(r);
    }
    runOn(indices);
  };

  const successCount = runResults?.filter((r) => !r.error && (r.status ?? 0) < 400).length ?? 0;
  const errorCount = runResults?.filter((r) => r.error || (r.status !== undefined && r.status >= 400)).length ?? 0;
  const mc = METHOD_COLORS[method] ?? METHOD_COLORS["GET"];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

      {/* Column reference helper */}
      {colLabels.length > 0 && (
        <div
          style={{
            padding: "8px 10px",
            background: "var(--at-accent-light)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid #c7dffe",
            display: "flex",
            gap: "6px",
            alignItems: "flex-start",
          }}
        >
          <Info size={12} style={{ color: "var(--at-accent)", marginTop: "1px", flexShrink: 0 }} />
          <div style={{ fontSize: "11px", color: "var(--at-accent)", lineHeight: 1.6 }}>
            <strong>Column refs:</strong>{" "}
            {colLabels.slice(0, 8).map((l) => `{{${l}}}`).join(", ")}
            {colLabels.length > 8 && ` … +${colLabels.length - 8} more`}
          </div>
        </div>
      )}

      {/* Method */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--at-text-muted)" }}>
          Method{" "}
          <span style={{ color: "var(--at-text-soft)", fontWeight: 400 }}>— Optional</span>
        </label>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowMethodDd(!showMethodDd)}
            style={{
              width: "100%",
              padding: "7px 10px",
              border: "1px solid var(--at-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--at-surface)",
              color: "var(--at-text)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              textAlign: "left",
            }}
          >
            <span
              style={{
                padding: "2px 7px",
                borderRadius: "3px",
                fontSize: "11px",
                fontWeight: 700,
                background: mc.bg,
                color: mc.color,
              }}
            >
              {method}
            </span>
            <ChevronDown
              size={13}
              style={{
                color: "var(--at-text-soft)",
                transform: showMethodDd ? "rotate(180deg)" : "none",
                transition: "transform 0.15s ease",
              }}
            />
          </button>

          {showMethodDd && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 49 }}
                onClick={() => setShowMethodDd(false)}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: "var(--at-surface)",
                  border: "1px solid var(--at-border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                {HTTP_METHODS.map((m) => {
                  const mc2 = METHOD_COLORS[m] ?? METHOD_COLORS["GET"];
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMethod(m);
                        setShowMethodDd(false);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "none",
                        background: m === method ? "var(--at-accent-light)" : "transparent",
                        color: m === method ? "var(--at-accent)" : "var(--at-text)",
                        fontSize: "12px",
                        fontWeight: m === method ? 600 : 400,
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: "9px",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        if (m !== method)
                          e.currentTarget.style.background = "var(--at-tab-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (m !== method) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: "3px",
                          fontSize: "10px",
                          fontWeight: 700,
                          background: mc2.bg,
                          color: mc2.color,
                          minWidth: "50px",
                          textAlign: "center",
                        }}
                      >
                        {m}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Endpoint */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--at-text-muted)" }}>
          Endpoint <span style={{ color: "var(--clr-error)", fontWeight: 600 }}>*</span>
        </label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://api.example.com/users/{{A}}"
          style={{ ...inputStyle, padding: "7px 10px", fontSize: "12px" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--at-accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--at-border)")}
        />
        <span style={{ fontSize: "10.5px", color: "var(--at-text-soft)", fontStyle: "italic" }}>
          Use {"{{A}}"}, {"{{B}}"} etc. to reference column values per row
        </span>
      </div>

      {/* Query parameters */}
      <SubSection label="Query parameters" defaultOpen={false}>
        <KVEditor
          pairs={queryParams}
          onChange={setQueryParams}
          keyPlaceholder="Key"
          valuePlaceholder="Enter value..."
          colHint={colHint}
        />
      </SubSection>

      {/* Body — only for methods that support it */}
      {(method === "POST" || method === "PATCH" || method === "PUT") && (
        <SubSection label="Body" defaultOpen={false}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'{\n  "name": "{{A}}",\n  "email": "{{B}}"\n}'}
            rows={5}
            style={{
              ...inputStyle,
              resize: "vertical",
              fontFamily: "monospace",
              fontSize: "11.5px",
              lineHeight: 1.55,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--at-accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--at-border)")}
          />
          <span style={{ fontSize: "10.5px", color: "var(--at-text-soft)", fontStyle: "italic" }}>
            JSON body. Use {"{{A}}"}, {"{{B}}"} to insert column values.
          </span>
        </SubSection>
      )}

      {/* Headers */}
      <SubSection label="Headers" defaultOpen={false}>
        <KVEditor
          pairs={reqHeaders}
          onChange={setReqHeaders}
          keyPlaceholder="Header name"
          valuePlaceholder="Header value"
        />
      </SubSection>

      {/* Response values to return */}
      <SubSection label="Response values to return" defaultOpen={false}>
        <input
          type="text"
          value={responseKeys}
          onChange={(e) => setResponseKeys(e.target.value)}
          placeholder="e.g. id, name, email (comma-separated)"
          style={{ ...inputStyle, padding: "7px 10px", fontSize: "12px" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--at-accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--at-border)")}
        />
        <span style={{ fontSize: "10.5px", color: "var(--at-text-soft)", fontStyle: "italic" }}>
          Leave empty to store the full response.
        </span>
      </SubSection>

      {/* Toggle options */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          borderTop: "1px solid var(--at-border-light)",
          paddingTop: "12px",
        }}
      >
        {(
          [
            { label: "Remove empty values", val: removeEmpty, set: setRemoveEmpty },
            { label: "Return response metadata", val: returnMeta, set: setReturnMeta },
            { label: "Follow redirects", val: followRedirects, set: setFollowRedirects },
          ] as const
        ).map(({ label, val, set }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div>
              <span style={{ fontSize: "12px", color: "var(--at-text)", fontWeight: 500 }}>
                {label}
              </span>{" "}
              <span style={{ fontSize: "11px", color: "var(--at-text-soft)" }}>— Optional</span>
            </div>
            <Toggle checked={val} onChange={set} />
          </div>
        ))}

        <SubSection label="Max redirects" defaultOpen={false}>
          <input
            type="number"
            value={maxRedirects}
            onChange={(e) => setMaxRedirects(e.target.value)}
            placeholder="e.g. 5"
            min={0}
            style={{ ...inputStyle, padding: "6px 10px", fontSize: "12px" }}
          />
        </SubSection>

        <SubSection label="Response timeout (ms)" defaultOpen={false}>
          <input
            type="number"
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(e.target.value)}
            placeholder="30000"
            min={100}
            style={{ ...inputStyle, padding: "6px 10px", fontSize: "12px" }}
          />
        </SubSection>
      </div>

      {/* Result column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          borderTop: "1px solid var(--at-border-light)",
          paddingTop: "12px",
        }}
      >
        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--at-text-muted)" }}>
          Write result to column{" "}
          <span style={{ color: "var(--at-text-soft)", fontWeight: 400 }}>— Optional</span>
        </label>
        <input
          type="text"
          value={resultCol}
          onChange={(e) => setResultCol(e.target.value.toUpperCase())}
          placeholder="e.g. C  (leave empty to append new column)"
          maxLength={3}
          style={{ ...inputStyle, padding: "7px 10px", fontSize: "12px", textTransform: "uppercase" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--at-accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--at-border)")}
        />
      </div>

      {/* Validation banner */}
      {!isValid && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#dc2626",
            fontSize: "12px",
            fontWeight: 500,
            padding: "6px 10px",
            background: "#fff5f5",
            borderRadius: "var(--radius-sm)",
            border: "1px solid #fca5a5",
          }}
        >
          <AlertCircle size={13} />
          Endpoint URL is required
        </div>
      )}

      {/* Run buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <button
          type="button"
          onClick={handleRunCurrentRow}
          disabled={!isValid || isRunning}
          style={{
            padding: "8px 10px",
            border: "1px solid var(--at-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--at-surface)",
            color: isValid && !isRunning ? "var(--at-text)" : "var(--at-text-soft)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: isValid && !isRunning ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            transition: "all 0.15s ease",
            opacity: isValid && !isRunning ? 1 : 0.55,
          }}
          onMouseEnter={(e) => {
            if (isValid && !isRunning) {
              e.currentTarget.style.borderColor = "var(--at-accent)";
              e.currentTarget.style.color = "var(--at-accent)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--at-border)";
            e.currentTarget.style.color = "var(--at-text)";
          }}
          title={`Run on row ${selectedCell.row + 1}`}
        >
          <Play size={12} fill="currentColor" />
          Run Row {selectedCell.row + 1}
        </button>

        <button
          type="button"
          onClick={handleRunAllRows}
          disabled={!isValid || isRunning}
          style={{
            padding: "8px 10px",
            border: "none",
            borderRadius: "var(--radius-sm)",
            background: isValid && !isRunning ? "var(--at-accent)" : "var(--at-border)",
            color: isValid && !isRunning ? "#fff" : "var(--at-text-soft)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: isValid && !isRunning ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            transition: "all 0.15s ease",
            opacity: isValid && !isRunning ? 1 : 0.55,
          }}
          onMouseEnter={(e) => {
            if (isValid && !isRunning) e.currentTarget.style.background = "var(--at-accent-dark)";
          }}
          onMouseLeave={(e) => {
            if (isValid && !isRunning) e.currentTarget.style.background = "var(--at-accent)";
          }}
        >
          {isRunning ? (
            <Loader2 size={12} className="spin" />
          ) : (
            <Globe size={12} />
          )}
          Run All Rows
        </button>
      </div>

      {/* Progress bar */}
      {runProgress && (
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <div
            style={{
              height: "4px",
              borderRadius: "2px",
              background: "var(--at-border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "var(--at-accent)",
                width: `${(runProgress.done / runProgress.total) * 100}%`,
                transition: "width 0.3s ease",
                borderRadius: "2px",
              }}
            />
          </div>
          <span style={{ fontSize: "11px", color: "var(--at-text-muted)" }}>
            Running {runProgress.done} / {runProgress.total} rows…
          </span>
        </div>
      )}

      {/* Results */}
      {runResults && runResults.length > 0 && (
        <div
          style={{
            border: "1px solid var(--at-border-light)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          {/* Results header */}
          <div
            style={{
              padding: "8px 12px",
              background: "var(--at-surface-2)",
              borderBottom: "1px solid var(--at-border-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--at-text)" }}>
              Results — {runResults.length} row{runResults.length !== 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", gap: "10px" }}>
              {successCount > 0 && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    color: "#16a34a",
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={11} />
                  {successCount} ok
                </span>
              )}
              {errorCount > 0 && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    color: "#dc2626",
                    fontWeight: 600,
                  }}
                >
                  <AlertCircle size={11} />
                  {errorCount} failed
                </span>
              )}
            </div>
          </div>

          {/* Result rows */}
          <div style={{ maxHeight: "220px", overflowY: "auto", background: "var(--at-surface)" }}>
            {runResults.map((r) => {
              const isErr = r.error || (r.status !== undefined && r.status >= 400);
              const preview = r.error
                ? r.error
                : `HTTP ${r.status} · ${r.ms}ms · ${extractValue(r.data, responseKeys).slice(0, 70) || "(empty)"}`;
              return (
                <div
                  key={r.rowIdx}
                  style={{
                    padding: "6px 12px",
                    borderBottom: "1px solid var(--at-border-light)",
                    display: "flex",
                    alignItems: "baseline",
                    gap: "10px",
                    fontSize: "11px",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: isErr ? "#dc2626" : "#16a34a",
                      minWidth: "50px",
                      flexShrink: 0,
                    }}
                  >
                    Row {r.rowIdx + 1}
                  </span>
                  <span
                    style={{
                      color: "var(--at-text-muted)",
                      flex: 1,
                      wordBreak: "break-all",
                      lineHeight: 1.4,
                    }}
                  >
                    {preview}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
