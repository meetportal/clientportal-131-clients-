"use client";

import React, { useState } from "react";
import { Table, Sparkles, CheckCircle2, ExternalLink, ArrowRight, Upload, FileSpreadsheet } from "lucide-react";
import { CreatedSheet } from "@/hooks/useSheetsApi";
import * as XLSX from "xlsx";
import { ImportedSheet } from "../SpreadsheetGrid";

interface CreateSheetProps {
  onCreated: (sheet: CreatedSheet, sheetName: string) => void;
  createSheet: (name: string, rows: string[][]) => Promise<CreatedSheet>;
  isLoading: boolean;
  onToast: (type: "success" | "error" | "info", title: string, desc?: string) => void;
  onImportExcel?: (sheets: ImportedSheet[], fileName: string) => void;
}

const SAMPLE_DATA = [
  ["Widget A", "1,200", "1,500", "1,800"],
  ["Widget B", "800", "950", "1,100"],
  ["Widget C", "2,200", "2,400", "2,700"],
  ["Widget D", "450", "600", "750"],
];

const EMPTY_DATA = [
  ["", "", "", ""],
  ["", "", "", ""],
  ["", "", "", ""],
  ["", "", "", ""],
];

const HEADERS = ["Product", "Q1 Sales", "Q2 Sales", "Q3 Sales"];

export function CreateSheet({
  onCreated,
  createSheet,
  isLoading,
  onToast,
  onImportExcel,
}: CreateSheetProps) {
  const [sheetName, setSheetName] = useState("My Sheet");
  const [tableData, setTableData] = useState<string[][]>(SAMPLE_DATA);
  const [usingSample, setUsingSample] = useState(true);
  const [created, setCreated] = useState<CreatedSheet | null>(null);
  const [createdName, setCreatedName] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const parsedSheets = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
          const grid = rawRows.map((row) =>
            row.map((val) => ({
              value: String(val ?? ""),
              style: {},
            }))
          );
          if (grid.length === 0) {
            grid.push([{ value: "", style: {} }]);
          }
          return { name, data: grid };
        });

        if (parsedSheets.length > 0 && onImportExcel) {
          onImportExcel(parsedSheets, file.name.replace(/\.[^/.]+$/, ""));
          onToast("success", "Spreadsheet imported!", `${file.name} loaded successfully.`);
        }
      } catch (err) {
        onToast("error", "Failed to parse file", "Please verify it is a valid spreadsheet.");
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUseSample = () => {
    setTableData(SAMPLE_DATA);
    setUsingSample(true);
  };

  const handleClearTable = () => {
    setTableData(EMPTY_DATA.map((r) => [...r]));
    setUsingSample(false);
  };

  const handleCellChange = (row: number, col: number, value: string) => {
    setTableData((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = value;
      return next;
    });
    setUsingSample(false);
  };

  const handleCreate = async () => {
    const name = sheetName.trim() || "My Sheet";
    try {
      const sheet = await createSheet(name, tableData);
      setCreated(sheet);
      setCreatedName(name);
      onToast("success", "Sheet created!", `"${name}" is ready in Google Sheets.`);
    } catch {
      onToast("error", "Failed to create sheet", "Check your OAuth credentials and try again.");
    }
  };

  /* ── Created state ──────────────────────────────────────────── */
  if (created) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "8px 0 4px" }}>
        <div className="success-icon-wrap">
          <CheckCircle2 size={32} color="#16a34a" strokeWidth={2.5} />
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 800, color: "#1c1917", marginBottom: "5px" }}>
            Sheet Created!
          </p>
          <p style={{ fontSize: "14px", color: "#78716c", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700, color: "#4355e8" }}>&ldquo;{createdName}&rdquo;</span>{" "}
            is live in Google Sheets.
          </p>
        </div>

        <a
          href={created.spreadsheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#4355e8",
            textDecoration: "none",
            padding: "7px 16px",
            borderRadius: "9px",
            background: "#eef2ff",
            border: "1.5px solid #c4d0fe",
            transition: "all 0.2s",
          }}
        >
          <ExternalLink size={13} />
          Open in Google Sheets
        </a>

        <button
          onClick={() => onCreated(created, createdName)}
          className="btn-primary"
          style={{ maxWidth: "320px", marginTop: "4px" }}
        >
          Continue to Hide Tabs
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  /* ── Default form state ─────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Sheet Name */}
      <div>
        <label className="field-label" htmlFor="sheet-name">Sheet Name</label>
        <input
          id="sheet-name"
          type="text"
          value={sheetName}
          onChange={(e) => setSheetName(e.target.value)}
          placeholder="My Sheet"
          className="field-input"
        />
      </div>

      {/* Data Table */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label className="field-label" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <Table size={13} color="#5b6ef5" />
            Sheet Data <span style={{ color: "#b8b0a8", fontWeight: 500 }}>(Tab 1)</span>
          </label>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={handleUseSample}
              className={`tbl-ctrl-btn ${usingSample ? "tbl-ctrl-btn--active" : "tbl-ctrl-btn--idle"}`}
            >
              <Sparkles size={11} />
              Sample
            </button>
            <button
              onClick={handleClearTable}
              className="tbl-ctrl-btn tbl-ctrl-btn--idle"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {HEADERS.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                        placeholder="—"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "11.5px", color: "#b8b0a8" }}>
          Tabs 2 and 3 are auto-populated with sample data.
        </p>
      </div>

      <button
        onClick={handleCreate}
        disabled={isLoading}
        className="btn-primary"
      >
        {isLoading ? (
          <>
            <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Creating Sheet…
          </>
        ) : (
          <>
            <Table size={16} />
            Create Sheet
          </>
        )}
      </button>

      {onImportExcel && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px", borderTop: "1px solid var(--at-border-light)", paddingTop: "15px" }}>
          <label className="field-label" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: 0 }}>
            <Upload size={13} color="var(--at-accent)" />
            Or Import Excel / CSV
          </label>
          <div
            style={{
              border: "1.5px dashed var(--at-border)",
              borderRadius: "var(--radius-md)",
              padding: "16px 12px",
              textAlign: "center",
              cursor: "pointer",
              background: "var(--at-surface-2)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--at-accent)";
              e.currentTarget.style.background = "var(--at-accent-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--at-border)";
              e.currentTarget.style.background = "var(--at-surface-2)";
            }}
            onClick={() => document.getElementById("excel-file-upload")?.click()}
          >
            <FileSpreadsheet size={22} color="var(--at-text-soft)" style={{ marginBottom: "6px", marginLeft: "auto", marginRight: "auto" }} />
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--at-text)" }}>
              Upload local sheet file
            </p>
            <p style={{ fontSize: "10.5px", color: "var(--at-text-soft)", marginTop: "2px" }}>
              Supports .xlsx, .xls, .csv, .tsv
            </p>
            <input
              id="excel-file-upload"
              type="file"
              accept=".xlsx, .xls, .csv, .tsv"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
          </div>
        </div>
      )}
    </div>
  );
}
