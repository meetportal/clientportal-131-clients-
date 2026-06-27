"use client";

import React, { useState } from "react";
import { CellData } from "@/components/SpreadsheetGrid";
import { FilteredDataResult } from "@/hooks/useFilteredData";
import { List, ChevronDown, ChevronRight } from "lucide-react";

interface ListViewProps {
  filteredData: FilteredDataResult;
  expandedRowIdx?: number | null;
  onRowExpand?: (idx: number | null) => void;
}

export function ListView({ filteredData }: ListViewProps) {
  const { rows } = filteredData;
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <div className="view-empty">
        <List size={32} strokeWidth={1.5} />
        <p>No data to display in List view</p>
      </div>
    );
  }

  const headers = rows[0].cells.map((c) => c.value || "");
  const dataRows = rows.slice(1);
  const primaryColIdx = 0;

  const toggle = (idx: number) => setExpandedIdx(expandedIdx === idx ? null : idx);

  return (
    <div className="list-root">
      <div className="list-stats">{dataRows.length} records</div>

      <div className="list-container">
        {/* Header row */}
        <div className="list-header-row">
          <span className="list-row-num">#</span>
          <span className="list-primary-header">{headers[primaryColIdx] || "Primary Field"}</span>
          {headers.slice(1, 4).map((h, i) => (
            <span key={i} className="list-field-header">{h || `Col ${i + 2}`}</span>
          ))}
          <span className="list-expand-col" />
        </div>

        {/* Data rows */}
        {dataRows.map((row) => {
          const isExpanded = expandedIdx === row.originalIdx;
          const primaryVal = row.cells[primaryColIdx]?.value || "—";

          return (
            <React.Fragment key={row.originalIdx}>
              <div
                className={`list-row${isExpanded ? " list-row--expanded" : ""}`}
                onClick={() => toggle(row.originalIdx)}
              >
                <span className="list-row-num">{row.originalIdx}</span>
                <span className="list-primary-val">{primaryVal}</span>
                {row.cells.slice(1, 4).map((cell, i) => (
                  <span key={i} className="list-field-val">{cell?.value || "—"}</span>
                ))}
                <span className="list-expand-col">
                  {isExpanded
                    ? <ChevronDown size={14} color="var(--at-accent)" />
                    : <ChevronRight size={14} color="var(--at-text-soft)" />
                  }
                </span>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div className="list-detail-panel">
                  <div className="list-detail-grid">
                    {headers.map((h, i) => (
                      <div key={i} className="list-detail-field">
                        <span className="list-detail-label">{h || `Col ${i + 1}`}</span>
                        <span className="list-detail-value">
                          {row.cells[i]?.value || <span style={{ color: "var(--at-text-soft)" }}>—</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
