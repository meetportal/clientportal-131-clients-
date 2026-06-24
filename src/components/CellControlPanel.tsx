"use client";

import React from "react";
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
} from "lucide-react";
import {
  CellData,
  CellStyle,
  ColumnMetadata,
  ImportedSheet,
  RowMetadata,
  getColLabel,
} from "./SpreadsheetGrid";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Return to wizard tab */}
      <button
        onClick={onCloseCellPanel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          border: "none",
          background: "transparent",
          color: "var(--at-accent)",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          padding: 0,
        }}
      >
        <ChevronLeft size={13} />
        Back to step configuration
      </button>

      {/* Cell Reference Header */}
      <div
        style={{
          borderBottom: "1px solid var(--at-border-light)",
          paddingBottom: "12px",
        }}
      >
        <h3
          style={{ fontSize: "16px", fontWeight: 700, color: "var(--at-text)" }}
        >
          Cell {cellRef} Actions
        </h3>
        <p
          style={{
            fontSize: "12px",
            color: "var(--at-text-soft)",
            marginTop: "2px",
          }}
        >
          Modify value, apply styles, or perform quick actions.
        </p>
      </div>

      {/* Edit Value */}
      <div>
        <label className="field-label" htmlFor="cell-value-textarea">
          Cell Content
        </label>
        <textarea
          id="cell-value-textarea"
          value={cell.value}
          onChange={handleValueChange}
          placeholder="Empty cell..."
          rows={3}
          style={{
            width: "100%",
            padding: "8px 11px",
            border: "1px solid var(--at-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--at-surface-2)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--at-text)",
            resize: "vertical",
            outline: "none",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "var(--at-accent)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "var(--at-border)")
          }
        />
      </div>

      {/* Text Styles & Alignments */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <span className="field-label">Typography & Align</span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => toggleStyle("bold")}
            style={{
              flex: 1,
              height: "32px",
              border: `1.5px solid ${style.bold ? "var(--at-accent)" : "var(--at-border)"}`,
              background: style.bold
                ? "var(--at-accent-light)"
                : "var(--at-surface)",
              color: style.bold ? "var(--at-accent)" : "var(--at-text-muted)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Bold"
          >
            <Bold size={15} />
          </button>
          <button
            onClick={() => toggleStyle("italic")}
            style={{
              flex: 1,
              height: "32px",
              border: `1.5px solid ${style.italic ? "var(--at-accent)" : "var(--at-border)"}`,
              background: style.italic
                ? "var(--at-accent-light)"
                : "var(--at-surface)",
              color: style.italic ? "var(--at-accent)" : "var(--at-text-muted)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Italic"
          >
            <Italic size={15} />
          </button>
          <button
            onClick={() => toggleStyle("underline")}
            style={{
              flex: 1,
              height: "32px",
              border: `1.5px solid ${style.underline ? "var(--at-accent)" : "var(--at-border)"}`,
              background: style.underline
                ? "var(--at-accent-light)"
                : "var(--at-surface)",
              color: style.underline
                ? "var(--at-accent)"
                : "var(--at-text-muted)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Underline"
          >
            <Underline size={15} />
          </button>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => setAlign("left")}
            style={{
              flex: 1,
              height: "32px",
              border: `1.5px solid ${style.align === "left" || !style.align ? "var(--at-accent)" : "var(--at-border)"}`,
              background:
                style.align === "left" || !style.align
                  ? "var(--at-accent-light)"
                  : "var(--at-surface)",
              color:
                style.align === "left" || !style.align
                  ? "var(--at-accent)"
                  : "var(--at-text-muted)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Align Left"
          >
            <AlignLeft size={15} />
          </button>
          <button
            onClick={() => setAlign("center")}
            style={{
              flex: 1,
              height: "32px",
              border: `1.5px solid ${style.align === "center" ? "var(--at-accent)" : "var(--at-border)"}`,
              background:
                style.align === "center"
                  ? "var(--at-accent-light)"
                  : "var(--at-surface)",
              color:
                style.align === "center"
                  ? "var(--at-accent)"
                  : "var(--at-text-muted)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Align Center"
          >
            <AlignCenter size={15} />
          </button>
          <button
            onClick={() => setAlign("right")}
            style={{
              flex: 1,
              height: "32px",
              border: `1.5px solid ${style.align === "right" ? "var(--at-accent)" : "var(--at-border)"}`,
              background:
                style.align === "right"
                  ? "var(--at-accent-light)"
                  : "var(--at-surface)",
              color:
                style.align === "right"
                  ? "var(--at-accent)"
                  : "var(--at-text-muted)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Align Right"
          >
            <AlignRight size={15} />
          </button>
        </div>
      </div>

      {/* Colors */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <span className="field-label">Text Color</span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "6px",
          }}
        >
          {TEXT_COLORS.map((tc) => {
            const isSelected = tc.value === (style.color || "");
            return (
              <button
                key={tc.name}
                onClick={() => setColor(tc.value)}
                style={{
                  height: "28px",
                  fontSize: "11px",
                  borderRadius: "4px",
                  border: isSelected
                    ? "1.5px solid var(--at-accent)"
                    : "1px solid var(--at-border-light)",
                  background: isSelected
                    ? "var(--at-accent-light)"
                    : "var(--at-surface)",
                  color: tc.value || "var(--at-text-muted)",
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {tc.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <span className="field-label">Background Fill</span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "6px",
          }}
        >
          {BG_COLORS.map((bgCol) => {
            const isSelected = bgCol.value === (style.bg || "");
            return (
              <button
                key={bgCol.name}
                onClick={() => setBg(bgCol.value)}
                style={{
                  height: "28px",
                  fontSize: "11px",
                  borderRadius: "4px",
                  border: isSelected
                    ? "1.5px solid var(--at-accent)"
                    : "1px solid var(--at-border-light)",
                  background: bgCol.value || "var(--at-surface)",
                  color: "var(--at-text-muted)",
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {bgCol.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Value Transformations */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <span className="field-label">Text Operations</span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
          }}
        >
          <button
            onClick={() => transformText("upper")}
            className="tbl-ctrl-btn"
            style={{
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "11.5px",
            }}
          >
            <Type size={12} />
            UPPERCASE
          </button>
          <button
            onClick={() => transformText("lower")}
            className="tbl-ctrl-btn"
            style={{
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "11.5px",
            }}
          >
            <Type size={12} />
            lowercase
          </button>
          <button
            onClick={() => transformText("trim")}
            className="tbl-ctrl-btn"
            style={{
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "11.5px",
            }}
          >
            <Sparkles size={12} />
            Trim Spaces
          </button>
          <button
            onClick={() => transformText("number")}
            className="tbl-ctrl-btn"
            style={{
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "11.5px",
            }}
          >
            <Binary size={12} />
            Parse Number
          </button>
        </div>
      </div>

      {/* Grid Operations */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <span className="field-label">Structural Operations</span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
          }}
        >
          <button
            onClick={() => addRow(false)}
            className="tbl-ctrl-btn"
            style={{
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "11.5px",
            }}
          >
            <PlusCircle size={12} />
            Insert Row Above
          </button>
          <button
            onClick={() => addRow(true)}
            className="tbl-ctrl-btn"
            style={{
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "11.5px",
            }}
          >
            <PlusCircle size={12} />
            Insert Row Below
          </button>
          <button
            onClick={() => addCol(false)}
            className="tbl-ctrl-btn"
            style={{
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "11.5px",
            }}
          >
            <PlusCircle size={12} />
            Insert Col Left
          </button>
          <button
            onClick={() => addCol(true)}
            className="tbl-ctrl-btn"
            style={{
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "11.5px",
            }}
          >
            <PlusCircle size={12} />
            Insert Col Right
          </button>
        </div>
      </div>

      {/* Visibility Operations */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <span className="field-label">Row & Column Visibility</span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
          }}
        >
          <button
            onClick={() => toggleRowVisibility(row)}
            className="tbl-ctrl-btn"
            style={{
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "11.5px",
            }}
            title={`Hide Row ${row + 1}`}
          >
            <EyeOff size={12} />
            Hide Row {row + 1}
          </button>
          <button
            onClick={() => toggleColVisibility(col)}
            className="tbl-ctrl-btn"
            style={{
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "11.5px",
            }}
            title={`Hide Column ${getColLabel(col)}`}
          >
            <EyeOff size={12} />
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
              borderTop: "1px solid var(--at-border-light)",
              paddingTop: "12px",
            }}
          >
            <span className="field-label">Hidden Items</span>

            {hiddenCols.length > 0 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--at-text-soft)",
                    fontWeight: 600,
                  }}
                >
                  Columns:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {hiddenCols.map((c) => {
                    const label = getColLabel(c.idx);
                    return (
                      <span
                        key={c.idx}
                        onClick={() => toggleColVisibility(c.idx)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: "#f4f4f2",
                          border: "1px solid var(--at-border)",
                          color: "var(--at-text-soft)",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        title="Click to unhide column"
                      >
                        Col {label}{" "}
                        <span
                          style={{
                            color: "#ef4444",
                            fontSize: "10px",
                            marginLeft: "2px",
                          }}
                        >
                          ✕
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {hiddenRows.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  marginTop: hiddenCols.length > 0 ? "8px" : "0px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--at-text-soft)",
                    fontWeight: 600,
                  }}
                >
                  Rows:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {hiddenRows.map((r) => (
                    <span
                      key={r.idx}
                      onClick={() => toggleRowVisibility(r.idx)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        background: "#f4f4f2",
                        border: "1px solid var(--at-border)",
                        color: "var(--at-text-soft)",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      title="Click to unhide row"
                    >
                      Row {r.idx + 1}{" "}
                      <span
                        style={{
                          color: "#ef4444",
                          fontSize: "10px",
                          marginLeft: "2px",
                        }}
                      >
                        ✕
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Clear cell */}
      <div
        style={{
          borderTop: "1px solid var(--at-border-light)",
          paddingTop: "12px",
        }}
      >
        <button
          onClick={clearCell}
          className="btn-secondary"
          style={{
            borderColor: "#fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            fontSize: "12.5px",
            fontWeight: 600,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fef2f2")}
        >
          <RotateCcw size={13} />
          Clear Cell Content & Styles
        </button>
      </div>
    </div>
  );
}
