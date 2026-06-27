"use client";

import React, { useState } from "react";
import { CellData } from "@/components/SpreadsheetGrid";
import { FilteredDataResult } from "@/hooks/useFilteredData";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarViewProps {
  filteredData: FilteredDataResult;
  dateColIndex: number;
  onDateColChange?: (colIdx: number) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ filteredData, dateColIndex, onDateColChange }: CalendarViewProps) {
  const { rows } = filteredData;
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  if (rows.length === 0) {
    return (
      <div className="view-empty">
        <CalendarIcon size={32} strokeWidth={1.5} />
        <p>No data to display in Calendar view</p>
      </div>
    );
  }

  const headers = rows[0].cells.map((c) => c.value || "");
  const dataRows = rows.slice(1);

  // Build a map: "YYYY-MM-DD" -> rows
  const dateMap = new Map<string, typeof dataRows>();
  dataRows.forEach((row) => {
    const raw = row.cells[dateColIndex]?.value ?? "";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!dateMap.has(key)) dateMap.set(key, []);
    dateMap.get(key)!.push(row);
  });

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Build 6-week grid (42 cells)
  const cells: Array<{ day: number; month: "prev" | "cur" | "next"; dateKey: string }> = [];

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = viewMonth === 0 ? 12 : viewMonth;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: d, month: "prev", dateKey: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d, month: "cur",
      dateKey: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }
  // Next month padding
  let next = 1;
  while (cells.length % 7 !== 0) {
    const m = viewMonth === 11 ? 1 : viewMonth + 2;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: next++, month: "next", dateKey: `${y}-${String(m).padStart(2, "0")}-${String(next - 1).padStart(2, "0")}` });
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const totalPlotted = Array.from(dateMap.values()).reduce((s, v) => s + v.length, 0);

  return (
    <div className="cal-root">
      {/* Header: nav + stats */}
      <div className="cal-header">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth} title="Previous month">
            <ChevronLeft size={16} />
          </button>
          <span className="cal-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button className="cal-nav-btn" onClick={nextMonth} title="Next month">
            <ChevronRight size={16} />
          </button>
        </div>

        <span className="cal-stats">{totalPlotted} records plotted</span>

        <button
          className="cal-nav-btn"
          onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}
          style={{ padding: "3px 10px", fontSize: 12, borderRadius: 5, minWidth: "auto" }}
        >
          Today
        </button>
      </div>

      {/* Day name headers */}
      <div className="cal-grid cal-grid--header">
        {DAY_NAMES.map(d => <div key={d} className="cal-day-name">{d}</div>)}
      </div>

      {/* Calendar grid */}
      <div className="cal-grid">
        {cells.map((cell, idx) => {
          const rowsOnDay = dateMap.get(cell.dateKey) ?? [];
          const isToday = cell.dateKey === todayKey && cell.month === "cur";
          return (
            <div
              key={idx}
              className={`cal-cell${cell.month !== "cur" ? " cal-cell--dim" : ""}${isToday ? " cal-cell--today" : ""}`}
            >
              <span className="cal-day-num">{cell.day}</span>
              <div className="cal-events">
                {rowsOnDay.slice(0, 3).map((row) => {
                  const primaryVal = row.cells.find((_, i) => i !== dateColIndex)?.value || `Row ${row.originalIdx}`;
                  return (
                    <div key={row.originalIdx} className="cal-event" title={primaryVal}>
                      {primaryVal}
                    </div>
                  );
                })}
                {rowsOnDay.length > 3 && (
                  <div className="cal-event-more">+{rowsOnDay.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
