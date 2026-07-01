"use client";

import React, { useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronLeft,
  Sparkles,
  Trash2,
  PlusCircle,
  RotateCcw,
  Type,
  Binary,
  Eye,
  EyeOff,
  X,
  Sliders,
  Globe,
} from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import {
  CellData,
  CellStyle,
  ColumnMetadata,
  ImportedSheet,
  RowMetadata,
  getColLabel,
} from "./SpreadsheetGrid";
import { HttpApiPanel } from "./HttpApiPanel";
import { JsonViewer } from "./JsonViewer";

interface CellControlPanelProps {
  selectedCell: { row: number; col: number };
  sheets: ImportedSheet[];
  activeSheetIdx: number;
  onSheetsChange: (updatedSheets: ImportedSheet[]) => void;
  onCloseCellPanel: () => void;
}

const TEXT_COLORS = [
  { name: "Default", value: "" },
  { name: "Dark Gray", value: "#1f2937" },
  { name: "Blue", value: "#2563eb" },
  { name: "Teal", value: "#0d9488" },
  { name: "Green", value: "#16a34a" },
  { name: "Red", value: "#dc2626" },
  { name: "Purple", value: "#9333ea" },
  { name: "Orange", value: "#ea580c" },
];

const BG_COLORS = [
  { name: "Default", value: "" },
  { name: "Light Gray", value: "#f3f4f6" },
  { name: "Soft Blue", value: "#dbeafe" },
  { name: "Soft Green", value: "#dcfce7" },
  { name: "Soft Red", value: "#fee2e2" },
  { name: "Soft Yellow", value: "#fef9c3" },
  { name: "Soft Purple", value: "#f3e8ff" },
  { name: "Soft Orange", value: "#ffedd5" },
];

export function CellControlPanel({
  selectedCell,
  sheets,
  activeSheetIdx,
  onSheetsChange,
  onCloseCellPanel,
}: CellControlPanelProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const currentSheet = sheets[activeSheetIdx];
  const { row, col } = selectedCell;
  const cell: CellData = currentSheet?.data[row]?.[col] || {
    value: "",
    style: {},
  };
  const style: CellStyle = cell.style || {};

  const cellRef = `${getColLabel(col)}${row + 1}`;

  const updateCell = (updatedValue: string, updatedStyle: CellStyle) => {
    const updatedSheets = [...sheets];
    const sheetData = updatedSheets[activeSheetIdx].data.map((r) =>
      r.map((c) => ({ ...c, style: { ...c.style } })),
    );

    if (!sheetData[row]) sheetData[row] = [];
    sheetData[row][col] = {
      value: updatedValue,
      style: updatedStyle,
    };

    updatedSheets[activeSheetIdx] = {
      ...updatedSheets[activeSheetIdx],
      data: sheetData,
    };
    onSheetsChange(updatedSheets);
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateCell(e.target.value, style);
  };

  const toggleStyle = (key: keyof CellStyle) => {
    const nextStyle = { ...style };
    if (key === "bold" || key === "italic" || key === "underline") {
      nextStyle[key] = !nextStyle[key];
    }
    updateCell(cell.value, nextStyle);
  };

  const setAlign = (align: "left" | "center" | "right") => {
    updateCell(cell.value, { ...style, align });
  };

  const setColor = (color: string) => {
    updateCell(cell.value, { ...style, color });
  };

  const setBg = (bg: string) => {
    updateCell(cell.value, { ...style, bg });
  };

  // Text transformations
  const transformText = (type: "upper" | "lower" | "trim" | "number") => {
    let nextVal = cell.value;
    if (type === "upper") nextVal = cell.value.toUpperCase();
    else if (type === "lower") nextVal = cell.value.toLowerCase();
    else if (type === "trim") nextVal = cell.value.trim();
    else if (type === "number") {
      const num = Number(cell.value.replace(/[^0-9.-]/g, ""));
      nextVal = isNaN(num) ? cell.value : String(num);
    }
    updateCell(nextVal, style);
  };

  // Clear cell data
  const clearCell = () => {
    updateCell("", {});
  };

  // Grid Operations inside control panel
  const addRow = (below: boolean) => {
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const sheetData = sheet.data.map((r) => r.map((c) => ({ ...c })));
    const targetIdx = below ? row + 1 : row;
    const colCount = sheetData[0]?.length || 4;

    const newRow = Array(colCount)
      .fill(null)
      .map(() => ({ value: "", style: {} }));

    sheetData.splice(targetIdx, 0, newRow);
    sheet.data = sheetData;

    const newRowsMeta = sheet.rows
      ? [...sheet.rows]
      : Array(sheetData.length - 1)
          .fill(null)
          .map(() => ({}));
    newRowsMeta.splice(targetIdx, 0, { hidden: false });
    sheet.rows = newRowsMeta;

    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
  };

  const addCol = (right: boolean) => {
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const sheetData = sheet.data.map((r) => r.map((c) => ({ ...c })));
    const targetIdx = right ? col + 1 : col;

    sheetData.forEach((r) => {
      r.splice(targetIdx, 0, { value: "", style: {} });
    });
    sheet.data = sheetData;

    const colCount = sheetData[0]?.length;
    const newColsMeta = sheet.cols
      ? [...sheet.cols]
      : Array(colCount - 1)
          .fill(null)
          .map(() => ({}));
    newColsMeta.splice(targetIdx, 0, { hidden: false });
    sheet.cols = newColsMeta;

    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
  };

  const toggleRowVisibility = (rowIdx: number) => {
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const rowCount = sheet.data.length;
    const newRowsMeta: RowMetadata[] = sheet.rows
      ? [...sheet.rows]
      : Array(rowCount)
          .fill(null)
          .map(() => ({}));
    const isHidden = !!newRowsMeta[rowIdx]?.hidden;
    newRowsMeta[rowIdx] = { ...newRowsMeta[rowIdx], hidden: !isHidden };
    sheet.rows = newRowsMeta;
    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
  };

  const toggleColVisibility = (colIdx: number) => {
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const colCount = sheet.data[0]?.length || 0;
    const newColsMeta: ColumnMetadata[] = sheet.cols
      ? [...sheet.cols]
      : Array(colCount)
          .fill(null)
          .map(() => ({}));
    const isHidden = !!newColsMeta[colIdx]?.hidden;
    newColsMeta[colIdx] = { ...newColsMeta[colIdx], hidden: !isHidden };
    sheet.cols = newColsMeta;
    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
  };

  const deleteRow = () => {
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const sheetData = sheet.data.map((r) => r.map((c) => ({ ...c })));

    if (sheetData.length <= 1) return;

    sheetData.splice(row, 1);
    sheet.data = sheetData;

    const newRowsMeta = sheet.rows
      ? [...sheet.rows]
      : Array(sheetData.length + 1)
          .fill(null)
          .map(() => ({}));
    newRowsMeta.splice(row, 1);
    sheet.rows = newRowsMeta;

    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
    onCloseCellPanel();
  };

  const deleteCol = () => {
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const sheetData = sheet.data.map((r) => r.map((c) => ({ ...c })));

    if (sheetData[0]?.length <= 1) return;

    sheetData.forEach((r) => {
      r.splice(col, 1);
    });
    sheet.data = sheetData;

    const colCount = sheetData[0]?.length + 1;
    const newColsMeta = sheet.cols
      ? [...sheet.cols]
      : Array(colCount)
          .fill(null)
          .map(() => ({}));
    newColsMeta.splice(col, 1);
    sheet.cols = newColsMeta;

    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
    onCloseCellPanel();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Return to wizard tab */}
      <button
        onClick={onCloseCellPanel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          border: "none",
          background: "transparent",
          color: "var(--at-accent)",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          padding: 0,
          width: "fit-content",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--at-accent-dark)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--at-accent)")}
      >
        <ChevronLeft size={14} />
        Back to step configuration
      </button>

      {/* Accordion 1: Formatting Settings */}
      <CollapsibleSection title="Formatting Settings" defaultOpen={true}>
        {/* Formula Bar Cell Content */}
        <div>
          <label className="field-label" htmlFor="cell-value-textarea" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span>Cell Value</span>
            {cell.value && (
              <button
                type="button"
                onClick={() => updateCell("", style)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--clr-error)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Clear text
              </button>
            )}
          </label>
          <div
            id="formula-bar-container"
            style={{
              display: "flex",
              alignItems: "stretch",
              border: "1px solid var(--at-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--at-surface-2)",
              overflow: "hidden",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 11px",
                borderRight: "1px solid var(--at-border-light)",
                background: "var(--at-tab-hover)",
                color: "var(--at-accent)",
                fontFamily: "monospace",
                fontSize: "13px",
                fontWeight: "bold",
                fontStyle: "italic",
                userSelect: "none",
              }}
            >
              fx
            </div>
            <textarea
              id="cell-value-textarea"
              value={cell.value}
              onChange={handleValueChange}
              placeholder="Enter value or formula..."
              rows={3}
              style={{
                flex: 1,
                padding: "8px 11px",
                border: "none",
                background: "transparent",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "var(--at-text)",
                resize: "vertical",
                outline: "none",
              }}
              onFocus={() => {
                const container = document.getElementById("formula-bar-container");
                if (container) {
                  container.style.borderColor = "var(--at-accent)";
                  container.style.boxShadow = "0 0 0 2px var(--at-accent-light)";
                }
              }}
              onBlur={() => {
                const container = document.getElementById("formula-bar-container");
                if (container) {
                  container.style.borderColor = "var(--at-border)";
                  container.style.boxShadow = "none";
                }
              }}
            />
          </div>
        </div>

        {/* Segmented Controls for Typography and Alignment */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignItems: "end" }}>
          {/* Typography Segment */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span className="field-label" style={{ margin: 0 }}>Typography</span>
            <div style={{ display: "flex", width: "100%", height: "32px", border: "1px solid var(--at-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => toggleStyle("bold")}
                style={{
                  flex: 1,
                  height: "100%",
                  border: "none",
                  background: style.bold ? "var(--at-accent-light)" : "var(--at-surface)",
                  color: style.bold ? "var(--at-accent)" : "var(--at-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRight: "1px solid var(--at-border-light)",
                  transition: "background 0.1s",
                }}
                title="Bold"
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                onClick={() => toggleStyle("italic")}
                style={{
                  flex: 1,
                  height: "100%",
                  border: "none",
                  background: style.italic ? "var(--at-accent-light)" : "var(--at-surface)",
                  color: style.italic ? "var(--at-accent)" : "var(--at-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRight: "1px solid var(--at-border-light)",
                  transition: "background 0.1s",
                }}
                title="Italic"
              >
                <Italic size={14} />
              </button>
              <button
                type="button"
                onClick={() => toggleStyle("underline")}
                style={{
                  flex: 1,
                  height: "100%",
                  border: "none",
                  background: style.underline ? "var(--at-accent-light)" : "var(--at-surface)",
                  color: style.underline ? "var(--at-accent)" : "var(--at-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.1s",
                }}
                title="Underline"
              >
                <Underline size={14} />
              </button>
            </div>
          </div>

          {/* Alignment Segment */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span className="field-label" style={{ margin: 0 }}>Align</span>
            <div style={{ display: "flex", width: "100%", height: "32px", border: "1px solid var(--at-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setAlign("left")}
                style={{
                  flex: 1,
                  height: "100%",
                  border: "none",
                  background: style.align === "left" || !style.align ? "var(--at-accent-light)" : "var(--at-surface)",
                  color: style.align === "left" || !style.align ? "var(--at-accent)" : "var(--at-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRight: "1px solid var(--at-border-light)",
                  transition: "background 0.1s",
                }}
                title="Align Left"
              >
                <AlignLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setAlign("center")}
                style={{
                  flex: 1,
                  height: "100%",
                  border: "none",
                  background: style.align === "center" ? "var(--at-accent-light)" : "var(--at-surface)",
                  color: style.align === "center" ? "var(--at-accent)" : "var(--at-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRight: "1px solid var(--at-border-light)",
                  transition: "background 0.1s",
                }}
                title="Align Center"
              >
                <AlignCenter size={14} />
              </button>
              <button
                type="button"
                onClick={() => setAlign("right")}
                style={{
                  flex: 1,
                  height: "100%",
                  border: "none",
                  background: style.align === "right" ? "var(--at-accent-light)" : "var(--at-surface)",
                  color: style.align === "right" ? "var(--at-accent)" : "var(--at-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.1s",
                }}
                title="Align Right"
              >
                <AlignRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Side-by-Side Dropdowns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Dropdown
            label="Text Color"
            options={TEXT_COLORS.map(tc => ({
              label: tc.name,
              value: tc.value,
              color: tc.value || undefined
            }))}
            selectedValue={style.color || ""}
            onSelect={setColor}
            placeholder="Default"
          />

          <Dropdown
            label="Background"
            options={BG_COLORS.map(bgCol => ({
              label: bgCol.name,
              value: bgCol.value,
              color: bgCol.value || undefined
            }))}
            selectedValue={style.bg || ""}
            onSelect={setBg}
            placeholder="None"
          />
        </div>
      </CollapsibleSection>

      {/* JSON Viewer — auto-shown when cell value is a JSON object or array */}
      {(() => {
        const v = cell.value.trim();
        if (!v.startsWith("{") && !v.startsWith("[")) return null;
        try {
          const parsed = JSON.parse(v);
          if (typeof parsed !== "object" || parsed === null) return null;
        } catch {
          return null;
        }
        return (
          <CollapsibleSection title="JSON Viewer" defaultOpen={true}>
            <JsonViewer rawJson={cell.value} />
          </CollapsibleSection>
        );
      })()}

      {/* Accordion 2: Visibility Settings */}
      <CollapsibleSection title="Visibility Settings" defaultOpen={false}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="field-label" style={{ margin: 0 }}>Hide Commands</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <button
              onClick={() => toggleRowVisibility(row)}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "12px",
                width: "100%",
              }}
              title={`Hide Row ${row + 1}`}
            >
              <EyeOff size={13} />
              Hide Row {row + 1}
            </button>
            <button
              onClick={() => toggleColVisibility(col)}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "12px",
                width: "100%",
              }}
              title={`Hide Column ${getColLabel(col)}`}
            >
              <EyeOff size={13} />
              Hide Col {getColLabel(col)}
            </button>
          </div>
        </div>

        {/* Hidden Items Checklist */}
        {(() => {
          const hiddenRows = (currentSheet?.rows || [])
            .map((r, rIdx) => ({ hidden: !!r.hidden, idx: rIdx }))
            .filter((r) => r.hidden);
          const hiddenCols = (currentSheet?.cols || [])
            .map((c, cIdx) => ({ hidden: !!c.hidden, idx: cIdx }))
            .filter((c) => c.hidden);

          if (hiddenRows.length === 0 && hiddenCols.length === 0) return null;

          return (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                border: "1px dashed var(--at-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--at-surface-2)",
                padding: "12px",
                marginTop: "4px",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--at-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hidden in Sheet</span>

              {hiddenCols.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10px", color: "var(--at-text-soft)", fontWeight: 600 }}>Columns (click to unhide):</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {hiddenCols.map((c) => (
                      <span
                        key={c.idx}
                        onClick={() => toggleColVisibility(c.idx)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: "var(--at-surface)",
                          border: "1px solid var(--at-border-light)",
                          color: "var(--at-text-muted)",
                          fontSize: "11px",
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--clr-error)";
                          e.currentTarget.style.color = "var(--clr-error)";
                          e.currentTarget.style.background = "var(--clr-error-bg)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--at-border-light)";
                          e.currentTarget.style.color = "var(--at-text-muted)";
                          e.currentTarget.style.background = "var(--at-surface)";
                        }}
                        title="Click to unhide column"
                      >
                        Col {getColLabel(c.idx)} <span style={{ fontSize: "9px" }}>✕</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {hiddenRows.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--at-text-soft)", fontWeight: 600 }}>Rows (click to unhide):</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {hiddenRows.map((r) => (
                      <span
                        key={r.idx}
                        onClick={() => toggleRowVisibility(r.idx)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: "var(--at-surface)",
                          border: "1px solid var(--at-border-light)",
                          color: "var(--at-text-muted)",
                          fontSize: "11px",
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--clr-error)";
                          e.currentTarget.style.color = "var(--clr-error)";
                          e.currentTarget.style.background = "var(--clr-error-bg)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--at-border-light)";
                          e.currentTarget.style.color = "var(--at-text-muted)";
                          e.currentTarget.style.background = "var(--at-surface)";
                        }}
                        title="Click to unhide row"
                      >
                        Row {r.idx + 1} <span style={{ fontSize: "9px" }}>✕</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* Accordion 3: HTTP API Request */}
      <CollapsibleSection title="HTTP API Request" defaultOpen={false}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <Globe size={13} color="var(--at-accent)" />
          <span style={{ fontSize: "11.5px", color: "var(--at-text-muted)", lineHeight: 1.4 }}>
            Configure and run HTTP requests using row data as inputs. Results are written back to the sheet.
          </span>
        </div>
        <HttpApiPanel
          sheets={sheets}
          activeSheetIdx={activeSheetIdx}
          selectedCell={selectedCell}
          onSheetsChange={onSheetsChange}
        />
      </CollapsibleSection>

      {/* Accordion 4: Structure & Actions */}
      <CollapsibleSection title="Structure & Actions" defaultOpen={false}>
        {/* Text Operations */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="field-label" style={{ margin: 0 }}>Text Operations</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <button
              onClick={() => transformText("upper")}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <Type size={13} />
              UPPERCASE
            </button>
            <button
              onClick={() => transformText("lower")}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <Type size={13} />
              lowercase
            </button>
            <button
              onClick={() => transformText("trim")}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <Sparkles size={13} />
              Trim Spaces
            </button>
            <button
              onClick={() => transformText("number")}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <Binary size={13} />
              Parse Number
            </button>
          </div>
        </div>

        {/* Grid Structure */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="field-label" style={{ margin: 0 }}>Grid Insertion</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <button
              onClick={() => addRow(false)}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <PlusCircle size={13} />
              Row Above
            </button>
            <button
              onClick={() => addRow(true)}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <PlusCircle size={13} />
              Row Below
            </button>
            <button
              onClick={() => addCol(false)}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <PlusCircle size={13} />
              Column Left
            </button>
            <button
              onClick={() => addCol(true)}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <PlusCircle size={13} />
              Column Right
            </button>
          </div>
        </div>

        {/* Danger Zone Warning Card */}
        <div
          style={{
            border: "1px solid #fca5a5",
            borderRadius: "var(--radius-md)",
            background: "#fff5f5",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "6px",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.05em" }}>Danger Zone</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <button
              onClick={deleteRow}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12px",
                color: "#b91c1c",
                borderColor: "#fca5a5",
                background: "#fff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fee2e2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
              }}
            >
              <Trash2 size={13} />
              Delete Row
            </button>
            <button
              onClick={deleteCol}
              className="tbl-ctrl-btn"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12px",
                color: "#b91c1c",
                borderColor: "#fca5a5",
                background: "#fff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fee2e2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
              }}
            >
              <Trash2 size={13} />
              Delete Col
            </button>
          </div>
          <button
            onClick={() => setShowClearConfirm(true)}
            style={{
              border: "1px solid #fca5a5",
              background: "#b91c1c",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              padding: "8px 12px",
              width: "100%",
              borderRadius: "5px",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#991b1b")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#b91c1c")}
          >
            <RotateCcw size={13} />
            Clear Cell Value & Styles
          </button>
        </div>
      </CollapsibleSection>

      {showClearConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(17, 24, 39, 0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            style={{
              backgroundColor: "var(--at-surface)",
              width: "380px",
              maxWidth: "90%",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--at-border)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "16px 20px",
                borderBottom: "1px solid var(--at-border-light)",
                background: "#fff5f5",
              }}
            >
              <RotateCcw size={16} color="#b91c1c" />
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#b91c1c", margin: 0 }}>
                Clear Cell Value & Styles?
              </h3>
            </div>

            {/* Body */}
            <div style={{ padding: "20px", fontSize: "13px", color: "var(--at-text-muted)", lineHeight: 1.5 }}>
              Are you sure you want to clear all cell contents and custom styling for cell <strong style={{ color: "var(--at-text)" }}>{cellRef}</strong>? This action cannot be undone.
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--at-border-light)",
                background: "var(--at-surface-2)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="btn-secondary"
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  width: "auto",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearCell();
                  setShowClearConfirm(false);
                }}
                style={{
                  border: "none",
                  background: "#b91c1c",
                  color: "#fff",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#991b1b")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#b91c1c")}
              >
                Clear Cell
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
