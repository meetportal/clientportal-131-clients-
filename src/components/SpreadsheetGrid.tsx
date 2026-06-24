"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Trash2,
  Download,
  CloudUpload,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  color?: string;
  bg?: string;
}

export interface CellData {
  value: string;
  style?: CellStyle;
}

export interface RowMetadata {
  hidden?: boolean;
}

export interface ColumnMetadata {
  hidden?: boolean;
}

export interface ImportedSheet {
  name: string;
  data: CellData[][];
  cols?: ColumnMetadata[];
  rows?: RowMetadata[];
}

interface SpreadsheetGridProps {
  sheets: ImportedSheet[];
  activeSheetIdx: number;
  selectedCell: { row: number; col: number } | null;
  onSheetsChange: (updatedSheets: ImportedSheet[]) => void;
  onActiveSheetIdxChange: (idx: number) => void;
  onSelectedCellChange: (cell: { row: number; col: number } | null) => void;
  onSyncToGoogle: () => void;
  onExportExcel: () => void;
  isSyncing?: boolean;
}

// Convert 0 -> A, 1 -> B, etc.
export function getColLabel(colIdx: number): string {
  let label = "";
  let temp = colIdx;
  while (temp >= 0) {
    label = String.fromCharCode((temp % 26) + 65) + label;
    temp = Math.floor(temp / 26) - 1;
  }
  return label;
}

export function SpreadsheetGrid({
  sheets,
  activeSheetIdx,
  selectedCell,
  onSheetsChange,
  onActiveSheetIdxChange,
  onSelectedCellChange,
  onSyncToGoogle,
  onExportExcel,
  isSyncing = false,
}: SpreadsheetGridProps) {
  const currentSheet = sheets[activeSheetIdx] || {
    name: "Sheet 1",
    data: [[]],
  };
  const gridData = currentSheet.data;

  const colsMetadata = currentSheet.cols || [];
  const rowsMetadata = currentSheet.rows || [];
  const isColHidden = (colIdx: number) => !!colsMetadata[colIdx]?.hidden;
  const isRowHidden = (rowIdx: number) => !!rowsMetadata[rowIdx]?.hidden;

  const hiddenRowsCount = rowsMetadata.filter((r) => r.hidden).length;
  const hiddenColsCount = colsMetadata.filter((c) => c.hidden).length;
  const totalHiddenCount = hiddenRowsCount + hiddenColsCount;

  const hideSelectedRow = () => {
    if (!selectedCell) return;
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const rowCount = sheet.data.length;
    const newRowsMeta = sheet.rows
      ? [...sheet.rows]
      : Array(rowCount)
          .fill(null)
          .map(() => ({}));
    newRowsMeta[selectedCell.row] = {
      ...newRowsMeta[selectedCell.row],
      hidden: true,
    };
    sheet.rows = newRowsMeta;
    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
    onSelectedCellChange(null);
  };

  const hideSelectedCol = () => {
    if (!selectedCell) return;
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const colCount = sheet.data[0]?.length || 0;
    const newColsMeta = sheet.cols
      ? [...sheet.cols]
      : Array(colCount)
          .fill(null)
          .map(() => ({}));
    newColsMeta[selectedCell.col] = {
      ...newColsMeta[selectedCell.col],
      hidden: true,
    };
    sheet.cols = newColsMeta;
    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
    onSelectedCellChange(null);
  };

  const unhideAll = () => {
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    if (sheet.rows) {
      sheet.rows = sheet.rows.map((r) => ({ ...r, hidden: false }));
    }
    if (sheet.cols) {
      sheet.cols = sheet.cols.map((c) => ({ ...c, hidden: false }));
    }
    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
  };

  const [formulaValue, setFormulaValue] = useState("");
  const [inlineEditingCell, setInlineEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState("");
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Sync formula bar input value with selected cell value
  useEffect(() => {
    if (selectedCell) {
      const cell = gridData[selectedCell.row]?.[selectedCell.col];
      setFormulaValue(cell?.value ?? "");
    } else {
      setFormulaValue("");
    }
  }, [selectedCell, gridData]);

  // Focus inline input when editing starts
  useEffect(() => {
    if (inlineEditingCell && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [inlineEditingCell]);

  const handleCellClick = (row: number, col: number) => {
    onSelectedCellChange({ row, col });
    setInlineEditingCell(null);
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    onSelectedCellChange({ row, col });
    setInlineEditingCell({ row, col });
    setInlineEditValue(gridData[row]?.[col]?.value ?? "");
  };

  const updateCellValue = (row: number, col: number, newValue: string) => {
    const updatedSheets = [...sheets];
    const sheetData = updatedSheets[activeSheetIdx].data.map((r) =>
      r.map((c) => ({ ...c })),
    );

    // Ensure the cell exists
    if (!sheetData[row]) {
      sheetData[row] = [];
    }
    if (!sheetData[row][col]) {
      sheetData[row][col] = { value: "", style: {} };
    }

    sheetData[row][col].value = newValue;
    updatedSheets[activeSheetIdx] = {
      ...updatedSheets[activeSheetIdx],
      data: sheetData,
    };
    onSheetsChange(updatedSheets);
  };

  const handleFormulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormulaValue(val);
    if (selectedCell) {
      updateCellValue(selectedCell.row, selectedCell.col, val);
    }
  };

  const handleInlineEditBlur = () => {
    if (inlineEditingCell) {
      updateCellValue(
        inlineEditingCell.row,
        inlineEditingCell.col,
        inlineEditValue,
      );
      setInlineEditingCell(null);
    }
  };

  const handleInlineEditKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      updateCellValue(
        inlineEditingCell!.row,
        inlineEditingCell!.col,
        inlineEditValue,
      );
      setInlineEditingCell(null);
    } else if (e.key === "Escape") {
      setInlineEditingCell(null);
    }
  };

  // Cell formatting toggles
  const toggleStyle = (styleKey: keyof CellStyle) => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    const updatedSheets = [...sheets];
    const sheetData = updatedSheets[activeSheetIdx].data.map((r) =>
      r.map((c) => ({ ...c, style: { ...c.style } })),
    );

    if (!sheetData[row]) sheetData[row] = [];
    if (!sheetData[row][col]) sheetData[row][col] = { value: "", style: {} };

    const style = sheetData[row][col].style || {};
    if (
      styleKey === "bold" ||
      styleKey === "italic" ||
      styleKey === "underline"
    ) {
      style[styleKey] = !style[styleKey];
    }

    sheetData[row][col].style = style;
    updatedSheets[activeSheetIdx] = {
      ...updatedSheets[activeSheetIdx],
      data: sheetData,
    };
    onSheetsChange(updatedSheets);
  };

  const setAlign = (align: "left" | "center" | "right") => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    const updatedSheets = [...sheets];
    const sheetData = updatedSheets[activeSheetIdx].data.map((r) =>
      r.map((c) => ({ ...c, style: { ...c.style } })),
    );

    if (!sheetData[row]) sheetData[row] = [];
    if (!sheetData[row][col]) sheetData[row][col] = { value: "", style: {} };

    const style = sheetData[row][col].style || {};
    style.align = align;

    sheetData[row][col].style = style;
    updatedSheets[activeSheetIdx] = {
      ...updatedSheets[activeSheetIdx],
      data: sheetData,
    };
    onSheetsChange(updatedSheets);
  };

  // Grid editing actions
  const addRow = (below = true) => {
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const sheetData = sheet.data.map((r) => r.map((c) => ({ ...c })));
    const targetIdx = selectedCell
      ? below
        ? selectedCell.row + 1
        : selectedCell.row
      : sheetData.length;
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
    if (selectedCell && !below && selectedCell.row >= targetIdx) {
      onSelectedCellChange({
        row: selectedCell.row + 1,
        col: selectedCell.col,
      });
    }
  };

  const deleteRow = () => {
    if (!selectedCell) return;
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const sheetData = sheet.data.map((r) => r.map((c) => ({ ...c })));

    if (sheetData.length <= 1) return; // Keep at least 1 row

    sheetData.splice(selectedCell.row, 1);
    sheet.data = sheetData;

    const newRowsMeta = sheet.rows
      ? [...sheet.rows]
      : Array(sheetData.length + 1)
          .fill(null)
          .map(() => ({}));
    newRowsMeta.splice(selectedCell.row, 1);
    sheet.rows = newRowsMeta;

    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
    onSelectedCellChange(null);
  };

  const addCol = (right = true) => {
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const sheetData = sheet.data.map((r) => r.map((c) => ({ ...c })));
    const targetIdx = selectedCell
      ? right
        ? selectedCell.col + 1
        : selectedCell.col
      : sheetData[0]?.length || 4;

    sheetData.forEach((row) => {
      row.splice(targetIdx, 0, { value: "", style: {} });
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
    if (selectedCell && !right && selectedCell.col >= targetIdx) {
      onSelectedCellChange({
        row: selectedCell.row,
        col: selectedCell.col + 1,
      });
    }
  };

  const deleteCol = () => {
    if (!selectedCell) return;
    const updatedSheets = [...sheets];
    const sheet = { ...updatedSheets[activeSheetIdx] };
    const sheetData = sheet.data.map((r) => r.map((c) => ({ ...c })));

    if (sheetData[0]?.length <= 1) return; // Keep at least 1 column

    sheetData.forEach((row) => {
      row.splice(selectedCell.col, 1);
    });
    sheet.data = sheetData;

    const colCount = sheetData[0]?.length + 1;
    const newColsMeta = sheet.cols
      ? [...sheet.cols]
      : Array(colCount)
          .fill(null)
          .map(() => ({}));
    newColsMeta.splice(selectedCell.col, 1);
    sheet.cols = newColsMeta;

    updatedSheets[activeSheetIdx] = sheet;
    onSheetsChange(updatedSheets);
    onSelectedCellChange(null);
  };

  const addNewTab = () => {
    const defaultData = Array(15)
      .fill(null)
      .map(() =>
        Array(8)
          .fill(null)
          .map(() => ({ value: "", style: {} })),
      );
    const newSheetName = `Sheet ${sheets.length + 1}`;
    onSheetsChange([...sheets, { name: newSheetName, data: defaultData }]);
    onActiveSheetIdxChange(sheets.length);
    onSelectedCellChange(null);
  };

  const deleteTab = (idx: number) => {
    if (sheets.length <= 1) return;
    const updated = sheets.filter((_, sIdx) => sIdx !== idx);
    onSheetsChange(updated);
    onActiveSheetIdxChange(Math.max(0, activeSheetIdx - 1));
    onSelectedCellChange(null);
  };

  // Get active styling to highlight toolbar buttons
  const activeStyle = selectedCell
    ? gridData[selectedCell.row]?.[selectedCell.col]?.style || {}
    : {};

  const selectedCellName = selectedCell
    ? `${getColLabel(selectedCell.col)}${selectedCell.row + 1}`
    : "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "var(--at-surface)",
        border: "1px solid var(--at-border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.04)",
        overflow: "hidden",
      }}
    >
      {/* ── Sub-toolbar for actions ──────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          borderBottom: "1px solid var(--at-border-light)",
          background: "var(--at-surface-2)",
          flexWrap: "wrap",
        }}
      >
        {/* Style Toolbar Group */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            borderRight: "1px solid var(--at-border)",
            paddingRight: "8px",
          }}
        >
          <button
            onClick={() => toggleStyle("bold")}
            disabled={!selectedCell}
            style={{
              padding: "5px",
              borderRadius: "4px",
              background: activeStyle.bold ? "#e2e8f0" : "transparent",
              color: !selectedCell ? "var(--at-text-soft)" : "var(--at-text)",
              cursor: selectedCell ? "pointer" : "default",
              border: "none",
            }}
            title="Bold"
          >
            <Bold size={15} />
          </button>
          <button
            onClick={() => toggleStyle("italic")}
            disabled={!selectedCell}
            style={{
              padding: "5px",
              borderRadius: "4px",
              background: activeStyle.italic ? "#e2e8f0" : "transparent",
              color: !selectedCell ? "var(--at-text-soft)" : "var(--at-text)",
              cursor: selectedCell ? "pointer" : "default",
              border: "none",
            }}
            title="Italic"
          >
            <Italic size={15} />
          </button>
          <button
            onClick={() => toggleStyle("underline")}
            disabled={!selectedCell}
            style={{
              padding: "5px",
              borderRadius: "4px",
              background: activeStyle.underline ? "#e2e8f0" : "transparent",
              color: !selectedCell ? "var(--at-text-soft)" : "var(--at-text)",
              cursor: selectedCell ? "pointer" : "default",
              border: "none",
            }}
            title="Underline"
          >
            <Underline size={15} />
          </button>
        </div>

        {/* Alignment Group */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            borderRight: "1px solid var(--at-border)",
            paddingRight: "8px",
          }}
        >
          <button
            onClick={() => setAlign("left")}
            disabled={!selectedCell}
            style={{
              padding: "5px",
              borderRadius: "4px",
              background:
                activeStyle.align === "left" || !activeStyle.align
                  ? "#e2e8f0"
                  : "transparent",
              color: !selectedCell ? "var(--at-text-soft)" : "var(--at-text)",
              cursor: selectedCell ? "pointer" : "default",
              border: "none",
            }}
            title="Align Left"
          >
            <AlignLeft size={15} />
          </button>
          <button
            onClick={() => setAlign("center")}
            disabled={!selectedCell}
            style={{
              padding: "5px",
              borderRadius: "4px",
              background:
                activeStyle.align === "center" ? "#e2e8f0" : "transparent",
              color: !selectedCell ? "var(--at-text-soft)" : "var(--at-text)",
              cursor: selectedCell ? "pointer" : "default",
              border: "none",
            }}
            title="Align Center"
          >
            <AlignCenter size={15} />
          </button>
          <button
            onClick={() => setAlign("right")}
            disabled={!selectedCell}
            style={{
              padding: "5px",
              borderRadius: "4px",
              background:
                activeStyle.align === "right" ? "#e2e8f0" : "transparent",
              color: !selectedCell ? "var(--at-text-soft)" : "var(--at-text)",
              cursor: selectedCell ? "pointer" : "default",
              border: "none",
            }}
            title="Align Right"
          >
            <AlignRight size={15} />
          </button>
        </div>

        {/* Row/Col Structure Group */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            borderRight: "1px solid var(--at-border)",
            paddingRight: "8px",
          }}
        >
          <button
            onClick={() => addRow(true)}
            disabled={!selectedCell}
            className="tbl-ctrl-btn"
            style={{ padding: "3px 6px", fontSize: "11px" }}
            title="Insert Row Below"
          >
            <Plus size={11} /> Row
          </button>
          <button
            onClick={() => addCol(true)}
            disabled={!selectedCell}
            className="tbl-ctrl-btn"
            style={{ padding: "3px 6px", fontSize: "11px" }}
            title="Insert Column Right"
          >
            <Plus size={11} /> Col
          </button>
          <button
            onClick={deleteRow}
            disabled={!selectedCell}
            className="tbl-ctrl-btn"
            style={{ padding: "3px 6px", fontSize: "11px", color: "#b91c1c" }}
            title="Delete Selected Row"
          >
            <Trash2 size={11} /> Row
          </button>
          <button
            onClick={deleteCol}
            disabled={!selectedCell}
            className="tbl-ctrl-btn"
            style={{ padding: "3px 6px", fontSize: "11px", color: "#b91c1c" }}
            title="Delete Selected Column"
          >
            <Trash2 size={11} /> Col
          </button>

          <div
            style={{
              width: "1px",
              height: "14px",
              background: "var(--at-border-light)",
              margin: "0 2px",
            }}
          />

          <button
            onClick={hideSelectedRow}
            disabled={!selectedCell}
            className="tbl-ctrl-btn"
            style={{ padding: "3px 6px", fontSize: "11px" }}
            title="Hide Selected Row"
          >
            <EyeOff size={11} /> Hide Row
          </button>
          <button
            onClick={hideSelectedCol}
            disabled={!selectedCell}
            className="tbl-ctrl-btn"
            style={{ padding: "3px 6px", fontSize: "11px" }}
            title="Hide Selected Column"
          >
            <EyeOff size={11} /> Hide Col
          </button>
          {totalHiddenCount > 0 && (
            <button
              onClick={unhideAll}
              className="tbl-ctrl-btn tbl-ctrl-btn--active"
              style={{ padding: "3px 6px", fontSize: "11px" }}
              title="Show all hidden rows and columns"
            >
              <Eye size={11} /> Unhide All ({totalHiddenCount})
            </button>
          )}
        </div>

        {/* Action Integrations */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginLeft: "auto",
          }}
        >
          <button
            onClick={onExportExcel}
            className="tbl-ctrl-btn"
            style={{
              padding: "4px 8px",
              fontSize: "11.5px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Download size={12} />
            Export Excel
          </button>
          <button
            onClick={onSyncToGoogle}
            disabled={isSyncing}
            className="btn-primary"
            style={{
              padding: "4px 10px",
              width: "auto",
              fontSize: "11.5px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "var(--clr-success)",
              boxShadow: "none",
            }}
          >
            {isSyncing ? (
              <RefreshCw size={12} className="spin" />
            ) : (
              <CloudUpload size={12} />
            )}
            Sync to Google Sheets
          </button>
        </div>
      </div>

      {/* ── Formula Bar ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 12px",
          borderBottom: "1px solid var(--at-border-light)",
          background: "var(--at-surface)",
          gap: "8px",
        }}
      >
        {/* Cell Reference */}
        <div
          style={{
            width: "50px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--at-surface-2)",
            border: "1px solid var(--at-border)",
            borderRadius: "4px",
            fontSize: "11.5px",
            fontWeight: 600,
            color: "var(--at-accent)",
            userSelect: "none",
          }}
        >
          {selectedCellName || "—"}
        </div>
        {/* FX Label */}
        <span
          style={{
            fontSize: "13px",
            fontFamily: "monospace",
            fontWeight: "bold",
            color: "var(--at-text-soft)",
            userSelect: "none",
          }}
        >
          fx
        </span>
        {/* Input */}
        <input
          type="text"
          value={formulaValue}
          onChange={handleFormulaChange}
          disabled={!selectedCell}
          placeholder={
            selectedCell
              ? "Enter cell value or text..."
              : "Select a cell to edit"
          }
          style={{
            flex: 1,
            height: "26px",
            border: "1px solid var(--at-border)",
            borderRadius: "4px",
            padding: "0 8px",
            fontSize: "12.5px",
            outline: "none",
            background: selectedCell
              ? "var(--at-surface)"
              : "var(--at-surface-2)",
          }}
        />
      </div>

      {/* ── Grid Container ──────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          background: "#fafaf9",
          position: "relative",
        }}
      >
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            tableLayout: "fixed",
            width: "max-content",
            fontFamily: "var(--font-body)",
          }}
        >
          <thead>
            <tr>
              {/* Corner Header */}
              <th
                style={{
                  position: "sticky",
                  top: 0,
                  left: 0,
                  zIndex: 30,
                  width: "40px",
                  height: "25px",
                  background: "#f4f4f2",
                  borderRight: "1px solid var(--at-border)",
                  borderBottom: "1px solid var(--at-border)",
                }}
              />
              {/* Column Headers */}
              {gridData[0]?.map((_, colIdx) => {
                if (isColHidden(colIdx)) return null;
                return (
                  <th
                    key={colIdx}
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 20,
                      width: "120px",
                      height: "25px",
                      background: "#f4f4f2",
                      borderRight: "1px solid var(--at-border)",
                      borderBottom: "1px solid var(--at-border)",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--at-text-muted)",
                      textAlign: "center",
                      verticalAlign: "middle",
                      userSelect: "none",
                    }}
                  >
                    {getColLabel(colIdx)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {gridData.map((row, rowIdx) => {
              if (isRowHidden(rowIdx)) return null;
              return (
                <tr key={rowIdx}>
                  {/* Row Header */}
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 10,
                      width: "40px",
                      height: "22px",
                      background: "#f4f4f2",
                      borderRight: "1px solid var(--at-border)",
                      borderBottom: "1px solid var(--at-border-light)",
                      fontSize: "10.5px",
                      fontWeight: 600,
                      color: "var(--at-text-soft)",
                      textAlign: "center",
                      verticalAlign: "middle",
                      userSelect: "none",
                    }}
                  >
                    {rowIdx + 1}
                  </td>
                  {/* Cells */}
                  {row.map((cell, colIdx) => {
                    if (isColHidden(colIdx)) return null;
                    const isSelected =
                      selectedCell?.row === rowIdx &&
                      selectedCell?.col === colIdx;
                    const isEditing =
                      inlineEditingCell?.row === rowIdx &&
                      inlineEditingCell?.col === colIdx;

                    // Render cell formatting
                    const { bold, italic, underline, align, color, bg } =
                      cell.style || {};

                    return (
                      <td
                        key={colIdx}
                        onClick={() => handleCellClick(rowIdx, colIdx)}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIdx, colIdx)
                        }
                        style={{
                          width: "120px",
                          height: "22px",
                          borderRight: "1px solid var(--at-border-light)",
                          borderBottom: "1px solid var(--at-border-light)",
                          background: isSelected
                            ? "#f0f7ff"
                            : bg || "var(--at-surface)",
                          color: color || "var(--at-text)",
                          fontWeight: bold ? "bold" : "normal",
                          fontStyle: italic ? "italic" : "normal",
                          textDecoration: underline ? "underline" : "none",
                          textAlign: align || "left",
                          fontSize: "12.5px",
                          padding: "0 6px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          verticalAlign: "middle",
                          cursor: "cell",
                          userSelect: "none",
                          outline: isSelected
                            ? "2px solid var(--at-accent)"
                            : "none",
                          outlineOffset: "-2px",
                        }}
                      >
                        {isEditing ? (
                          <input
                            ref={inlineInputRef}
                            type="text"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={handleInlineEditBlur}
                            onKeyDown={handleInlineEditKeyDown}
                            style={{
                              width: "100%",
                              height: "100%",
                              border: "none",
                              outline: "none",
                              background: "transparent",
                              fontSize: "12.5px",
                              fontFamily: "var(--font-body)",
                              padding: 0,
                            }}
                          />
                        ) : (
                          cell.value
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Sheet Tabs Footer ───────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "32px",
          borderTop: "1px solid var(--at-border)",
          background: "var(--at-surface-2)",
          padding: "0 12px",
          gap: "2px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            height: "100%",
          }}
        >
          {sheets.map((sheet, idx) => {
            const isActive = idx === activeSheetIdx;
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  background: isActive ? "var(--at-surface)" : "transparent",
                  borderLeft: `1px solid ${isActive ? "var(--at-border)" : "transparent"}`,
                  borderRight: `1px solid ${isActive ? "var(--at-border)" : "transparent"}`,
                  borderTop: isActive ? "2.5px solid var(--at-accent)" : "none",
                  borderBottom: isActive ? "none" : "1px solid transparent",
                  padding: "0 10px",
                  cursor: "pointer",
                  fontSize: "11.5px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "var(--at-accent)" : "var(--at-text-muted)",
                }}
                onClick={() => {
                  onActiveSheetIdxChange(idx);
                  onSelectedCellChange(null);
                }}
              >
                <span>{sheet.name}</span>
                {sheets.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTab(idx);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--at-text-soft)",
                      marginLeft: "6px",
                      cursor: "pointer",
                      fontSize: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      width: "12px",
                      height: "12px",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#e2e8f0")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                    title="Delete sheet"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          {/* Add sheet button */}
          <button
            onClick={addNewTab}
            style={{
              padding: "4px",
              borderRadius: "4px",
              border: "none",
              background: "transparent",
              color: "var(--at-text-muted)",
              cursor: "pointer",
              marginLeft: "4px",
            }}
            title="Add sheet tab"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
