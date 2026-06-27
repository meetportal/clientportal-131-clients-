"use client";

import React, { useState } from "react";
import { CellData } from "@/components/SpreadsheetGrid";
import { FilteredDataResult } from "@/hooks/useFilteredData";
import { LayoutGrid, ChevronDown } from "lucide-react";

interface KanbanViewProps {
  filteredData: FilteredDataResult;
  onGroupColChange?: (colIdx: number) => void;
  groupColIndex: number;
}

const CARD_COLORS = [
  "#e8f0fe", "#fce8f3", "#dcfce7", "#fef9c3",
  "#ffedd5", "#f3e8ff", "#dbeafe", "#fee2e2",
];

export function KanbanView({ filteredData, groupColIndex, onGroupColChange }: KanbanViewProps) {
  const { rows } = filteredData;
  if (rows.length === 0) {
    return (
      <div className="view-empty">
        <LayoutGrid size={32} strokeWidth={1.5} />
        <p>No data to display in Kanban view</p>
      </div>
    );
  }

  // Row 0 is always the header
  const headers = rows[0].cells.map((c) => c.value || "");
  const dataRows = rows.slice(1);

  // Group by the selected column
  const groups = new Map<string, typeof dataRows>();
  dataRows.forEach((row) => {
    const key = row.cells[groupColIndex]?.value?.trim() || "(Empty)";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  const groupKeys = Array.from(groups.keys());

  return (
    <div className="kanban-root">
      {/* Board */}
      <div className="kanban-board">
        {groupKeys.map((key, gIdx) => {
          const cards = groups.get(key)!;
          const bgColor = CARD_COLORS[gIdx % CARD_COLORS.length];
          return (
            <div key={key} className="kanban-column">
              {/* Column header */}
              <div className="kanban-col-header" style={{ borderTopColor: bgColor }}>
                <span className="kanban-col-title">{key}</span>
                <span className="kanban-col-count">{cards.length}</span>
              </div>
              {/* Cards */}
              <div className="kanban-cards">
                {cards.map((row) => (
                  <div key={row.originalIdx} className="kanban-card">
                    {/* Primary field: column after group col */}
                    <div className="kanban-card-primary">
                      {row.cells.filter((_, i) => i !== groupColIndex).slice(0, 1).map((c, i) => (
                        <span key={i} className="kanban-card-title">{c.value || "—"}</span>
                      ))}
                    </div>
                    {/* Other fields */}
                    <div className="kanban-card-fields">
                      {headers.map((h, i) => {
                        if (i === groupColIndex) return null;
                        const cell = row.cells[i];
                        if (!cell?.value) return null;
                        return (
                          <div key={i} className="kanban-card-field">
                            <span className="kanban-field-label">{h || `Col ${i + 1}`}</span>
                            <span className="kanban-field-value">{cell.value}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="kanban-card-row-num">Row {row.originalIdx}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
