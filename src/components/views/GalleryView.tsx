"use client";

import React from "react";
import { CellData, ImportedSheet } from "@/components/SpreadsheetGrid";
import { FilteredDataResult } from "@/hooks/useFilteredData";
import { Image as ImageIcon, ExternalLink, Calendar, Check, X } from "lucide-react";

interface GalleryViewProps {
  sheet: ImportedSheet | null;
  filteredData: FilteredDataResult;
  primaryColIndex?: number;
}

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", // Indigo / Violet
  "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)", // Pink / Rose
  "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)", // Sky / Blue
  "linear-gradient(135deg, #10b981 0%, #059669 100%)", // Emerald / Green
  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", // Amber / Bronze
  "linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)", // Purple / Fuchsia
  "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)", // Teal / Dark Teal
  "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", // Orange / Rust
];

function isImageUrl(val: string): boolean {
  if (!val) return false;
  const cleaned = val.trim().toLowerCase();
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) return false;
  return (
    cleaned.endsWith(".png") ||
    cleaned.endsWith(".jpg") ||
    cleaned.endsWith(".jpeg") ||
    cleaned.endsWith(".gif") ||
    cleaned.endsWith(".webp") ||
    cleaned.endsWith(".svg") ||
    cleaned.includes("images.unsplash.com") ||
    cleaned.includes("picsum.photos")
  );
}

function renderValue(val: string, headerName: string) {
  if (!val) return <span className="gallery-field-val gallery-field-val--empty">(Empty)</span>;

  const cleanedVal = val.trim();
  const lowerVal = cleanedVal.toLowerCase();
  const lowerHeader = headerName.toLowerCase();

  // 1. Image URL (already handled in cover, but if displayed in field render as thumbnail/link)
  if (isImageUrl(cleanedVal)) {
    return (
      <a
        href={cleanedVal}
        target="_blank"
        rel="noopener noreferrer"
        className="gallery-link-badge"
      >
        <ImageIcon size={10} /> View Image <ExternalLink size={8} />
      </a>
    );
  }

  // 2. Email Address
  if (cleanedVal.includes("@") && cleanedVal.includes(".") && !cleanedVal.includes(" ")) {
    return (
      <a href={`mailto:${cleanedVal}`} className="gallery-link">
        {cleanedVal}
      </a>
    );
  }

  // 3. URLs
  if (lowerVal.startsWith("http://") || lowerVal.startsWith("https://")) {
    return (
      <a
        href={cleanedVal}
        target="_blank"
        rel="noopener noreferrer"
        className="gallery-link"
      >
        {cleanedVal} <ExternalLink size={10} style={{ marginLeft: 2 }} />
      </a>
    );
  }

  // 4. Boolean values
  if (lowerVal === "true" || lowerVal === "yes" || lowerVal === "checked") {
    return (
      <span className="gallery-badge gallery-badge--success">
        <Check size={10} strokeWidth={3} /> Yes
      </span>
    );
  }
  if (lowerVal === "false" || lowerVal === "no" || lowerVal === "unchecked") {
    return (
      <span className="gallery-badge gallery-badge--neutral">
        <X size={10} strokeWidth={3} /> No
      </span>
    );
  }

  // 5. Special Statuses
  if (lowerVal === "active" || lowerVal === "completed" || lowerVal === "success" || lowerVal === "paid") {
    return <span className="gallery-badge gallery-badge--success">{cleanedVal}</span>;
  }
  if (lowerVal === "pending" || lowerVal === "in progress" || lowerVal === "warning" || lowerVal === "pending sync") {
    return <span className="gallery-badge gallery-badge--warning">{cleanedVal}</span>;
  }
  if (lowerVal === "inactive" || lowerVal === "error" || lowerVal === "failed" || lowerVal === "cancelled") {
    return <span className="gallery-badge gallery-badge--danger">{cleanedVal}</span>;
  }

  // 6. Departments
  if (lowerHeader === "department") {
    let theme = "gallery-badge--neutral";
    if (lowerVal === "engineering") theme = "gallery-badge--blue";
    else if (lowerVal === "marketing") theme = "gallery-badge--pink";
    else if (lowerVal === "sales") theme = "gallery-badge--green";
    else if (lowerVal === "support") theme = "gallery-badge--yellow";
    else if (lowerVal === "management") theme = "gallery-badge--indigo";
    else if (lowerVal === "security") theme = "gallery-badge--red";
    else if (lowerVal === "research") theme = "gallery-badge--purple";

    return <span className={`gallery-badge ${theme}`}>{cleanedVal}</span>;
  }

  // 7. Dates (Format YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanedVal)) {
    return (
      <span className="gallery-date">
        <Calendar size={11} />
        {cleanedVal}
      </span>
    );
  }

  // 8. Scores / Numbers (Header contains score or rating)
  if ((lowerHeader.includes("score") || lowerHeader.includes("rating")) && !isNaN(Number(cleanedVal))) {
    const scoreNum = Number(cleanedVal);
    const scorePercent = scoreNum <= 1 ? scoreNum * 100 : scoreNum;
    return (
      <div className="gallery-score-wrap">
        <span className="gallery-score-num">{scorePercent}%</span>
        <div className="gallery-score-bar-bg">
          <div className="gallery-score-bar-fill" style={{ width: `${Math.min(100, Math.max(0, scorePercent))}%` }} />
        </div>
      </div>
    );
  }

  // Default: Text
  return <span className="gallery-field-val" title={cleanedVal}>{cleanedVal}</span>;
}

export function GalleryView({ sheet, filteredData, primaryColIndex = 0 }: GalleryViewProps) {
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
          const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
          const primaryValue = row.cells[primaryColIndex]?.value?.trim() || `Row ${row.originalIdx}`;
          
          // Try to find an image in the row cells for the cover image
          let coverImgUrl = "";
          row.cells.forEach((cell) => {
            if (!coverImgUrl && isImageUrl(cell.value)) {
              coverImgUrl = cell.value.trim();
            }
          });

          return (
            <div key={row.originalIdx} className="gallery-card">
              {/* Cover area */}
              <div 
                className="gallery-card-cover" 
                style={coverImgUrl ? {} : { background: gradient }}
              >
                {coverImgUrl && (
                  <img src={coverImgUrl} alt={primaryValue} className="gallery-cover-img" />
                )}
                {/* Floating glassmorphic row badge */}
                <span className="gallery-row-badge-floating">#{row.originalIdx}</span>
              </div>

              {/* Card body */}
              <div className="gallery-card-body">
                <p className="gallery-card-title" title={primaryValue}>{primaryValue}</p>

                {/* Fields */}
                <div className="gallery-card-fields">
                  {headers.map((h, i) => {
                    if (i === primaryColIndex) return null;
                    if (sheet?.cols?.[i]?.hidden) return null; // Sync hidden fields!
                    const val = row.cells[i]?.value ?? "";
                    return (
                      <div key={i} className="gallery-field-row">
                        <span className="gallery-field-label" title={h || `Column ${i + 1}`}>
                          {h || `Col ${i + 1}`}
                        </span>
                        <div className="gallery-field-val-wrapper">
                          {renderValue(val, h || "")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
