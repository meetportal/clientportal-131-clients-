"use client";

import React from "react";
import { CellData } from "@/components/SpreadsheetGrid";
import { FilteredDataResult } from "@/hooks/useFilteredData";
import { Image as ImageIcon } from "lucide-react";

interface GalleryViewProps {
  filteredData: FilteredDataResult;
  primaryColIndex?: number;
}

const CARD_ACCENT_COLORS = [
  "#166ee1", "#16a34a", "#9333ea", "#ea580c",
  "#dc2626", "#0d9488", "#d97706", "#db2777",
];

export function GalleryView({ filteredData, primaryColIndex = 0 }: GalleryViewProps) {
  const { rows } = filteredData;

  if (rows.length === 0) {
    return (
      <div className="view-empty">
        <ImageIcon size={32} strokeWidth={1.5} />
        <p>No data to display in Gallery view</p>
      </div>
    );
  }

  const headers = rows[0].cells.map((c) => c.value || "");
  const dataRows = rows.slice(1);

  return (
    <div className="gallery-root">
      <div className="gallery-stats">{dataRows.length} records</div>
      <div className="gallery-grid">
        {dataRows.map((row, idx) => {
          const accent = CARD_ACCENT_COLORS[idx % CARD_ACCENT_COLORS.length];
          const primaryValue = row.cells[primaryColIndex]?.value || `Row ${row.originalIdx}`;
          // Get initials from primary value
          const initials = primaryValue
            .split(/\s+/)
            .slice(0, 2)
            .map((w: string) => w[0]?.toUpperCase() ?? "")
            .join("");

          return (
            <div key={row.originalIdx} className="gallery-card">
              {/* Card header / avatar area */}
              <div className="gallery-card-header" style={{ background: `${accent}18` }}>
                <div className="gallery-avatar" style={{ background: accent }}>
                  {initials || String(row.originalIdx)}
                </div>
              </div>

              {/* Card body */}
              <div className="gallery-card-body">
                <p className="gallery-card-title">{primaryValue}</p>

                {/* All other fields */}
                <div className="gallery-card-fields">
                  {headers.map((h, i) => {
                    if (i === primaryColIndex) return null;
                    const val = row.cells[i]?.value;
                    if (!val) return null;
                    return (
                      <div key={i} className="gallery-field-row">
                        <span className="gallery-field-label">{h || `Col ${i + 1}`}</span>
                        <span className="gallery-field-val">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="gallery-card-footer">
                <span className="gallery-row-badge">#{row.originalIdx}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
