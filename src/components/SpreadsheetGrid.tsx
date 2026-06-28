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

export interface SheetWebhookSettings {
  enabled: boolean;
  url: string;
}

export interface SheetApiSettings {
  enabled: boolean;
  isPublic: boolean;
  apiKey?: string;
}

export interface ImportedSheet {
  name: string;
  data: CellData[][];
  cols?: ColumnMetadata[];
  rows?: RowMetadata[];
  apiSettings?: SheetApiSettings;
  webhookSettings?: SheetWebhookSettings;
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
  /** When provided, only rows whose original index are in this array are rendered */
  filteredRowIndices?: number[];
  /** Term to highlight in cells */
  searchTerm?: string;
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
  filteredRowIndices: filteredRowIndicesArr,
  searchTerm = "",
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
    if (!selectedCell || selectedCell.col === -1) return;
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
    if (selectedCell && selectedCell.col !== -1) {
      const cell = gridData[selectedCell.row]?.[selectedCell.col];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormulaValue(cell?.value ?? "");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (selectedCell && selectedCell.col !== -1) {
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

    const applyToCell = (rIdx: number, cIdx: number) => {
      if (!sheetData[rIdx]) sheetData[rIdx] = [];
      if (!sheetData[rIdx][cIdx]) sheetData[rIdx][cIdx] = { value: "", style: {} };

      const style = sheetData[rIdx][cIdx].style || {};
      if (
        styleKey === "bold" ||
        styleKey === "italic" ||
        styleKey === "underline"
      ) {
        style[styleKey] = !style[styleKey];
      }
      sheetData[rIdx][cIdx].style = style;
    };

    if (col !== -1) {
      applyToCell(row, col);
    } else {
      const colCount = sheetData[row]?.length || 0;
      for (let c = 0; c < colCount; c++) {
        applyToCell(row, c);
      }
    }

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

    const applyToCell = (rIdx: number, cIdx: number) => {
      if (!sheetData[rIdx]) sheetData[rIdx] = [];
      if (!sheetData[rIdx][cIdx]) sheetData[rIdx][cIdx] = { value: "", style: {} };

      const style = sheetData[rIdx][cIdx].style || {};
      style.align = align;
      sheetData[rIdx][cIdx].style = style;
    };

    if (col !== -1) {
      applyToCell(row, col);
    } else {
      const colCount = sheetData[row]?.length || 0;
      for (let c = 0; c < colCount; c++) {
        applyToCell(row, c);
      }
    }

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
    if (selectedCell && selectedCell.col === -1) return;
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
    if (!selectedCell || selectedCell.col === -1) return;
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
            {(() => {
              // Build the list of row indices we want to render, in the correct order.
              // Row 0 (user's header) is always rendered first.
              const rowIndices = [0];
              if (filteredRowIndicesArr) {
                rowIndices.push(...filteredRowIndicesArr);
              } else {
                for (let i = 1; i < gridData.length; i++) {
                  rowIndices.push(i);
                }
              }

              return rowIndices.map((rowIdx) => {
                const row = gridData[rowIdx];
                if (!row || isRowHidden(rowIdx)) return null;
                return (
                  <tr key={rowIdx}>
                    {/* Row Header */}
                    <td
                      onClick={() => onSelectedCellChange({ row: rowIdx, col: -1 })}
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 10,
                        width: "40px",
                        height: "22px",
                        background: selectedCell?.row === rowIdx ? "#e2e8f0" : "#f4f4f2",
                        borderRight: "1px solid var(--at-border)",
                        borderBottom: "1px solid var(--at-border-light)",
                        fontSize: "10.5px",
                        fontWeight: selectedCell?.row === rowIdx ? 700 : 600,
                        color: selectedCell?.row === rowIdx ? "var(--at-accent)" : "var(--at-text-soft)",
                        textAlign: "center",
                        verticalAlign: "middle",
                        userSelect: "none",
                        cursor: "pointer",
                      }}
                    >
                      {rowIdx + 1}
                    </td>
                    {/* Cells */}
                    {row.map((cell, colIdx) => {
                      if (isColHidden(colIdx)) return null;
                      const isSelected =
                        selectedCell?.row === rowIdx &&
                        (selectedCell?.col === colIdx || selectedCell?.col === -1);
                      const isEditing =
                        inlineEditingCell?.row === rowIdx &&
                        inlineEditingCell?.col === colIdx;

                      // Render cell formatting
                      const { bold, italic, underline, align, color, bg } =
                        cell.style || {};

                      // Determine search highlight
                      const term = searchTerm.trim().toLowerCase();
                      const isSearchMatch = term !== "" && cell.value.toLowerCase().includes(term);

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
                              : isSearchMatch
                              ? "#fefce8"
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
                            outline: isSelected && selectedCell?.col !== -1
                              ? "2px solid var(--at-accent)"
                              : isSearchMatch
                              ? "1px solid #facc15"
                              : "none",
                            outlineOffset: "-1px",
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
              });
            })()}
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
