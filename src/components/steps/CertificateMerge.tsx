"use client";

import React, { useState } from "react";
import {
  Award,
  Play,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { ImportedSheet, getColLabel } from "../SpreadsheetGrid";

interface CertificateMergeProps {
  sheets: ImportedSheet[];
  activeSheetIdx: number;
  spreadsheetId: string | null;
  isLoading: boolean;
  onToast: (type: "success" | "error" | "info", title: string, desc?: string) => void;
  onSheetsChange: (updated: ImportedSheet[]) => void;
  copyTemplateDoc: (templateId: string, name: string) => Promise<string>;
  replaceDocPlaceholders: (docId: string, replacements: Record<string, string>) => Promise<void>;
  makeFilePublic: (fileId: string) => Promise<string>;
  writeCellToSheet: (spreadsheetId: string, range: string, value: string) => Promise<void>;
  sendGmailMessage: (to: string, subject: string, body: string) => Promise<void>;
}

interface MergeProgress {
  row: number;
  name: string;
  status: "idle" | "copying" | "replacing" | "sharing" | "writing" | "emailing" | "success" | "error";
  message: string;
}

function extractDocId(input: string): string {
  const trimmed = input.trim();
  // Match /document/d/([a-zA-Z0-9-_]+)
  const docMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (docMatch) return docMatch[1];
  
  // Also support spreadsheets just in case they paste a sheet URL
  const sheetMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetMatch) return sheetMatch[1];

  // Also support general file links
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (fileMatch) return fileMatch[1];
  
  return trimmed;
}

export function CertificateMerge({
  sheets,
  activeSheetIdx,
  spreadsheetId,
  isLoading: apiLoading,
  onToast,
  onSheetsChange,
  copyTemplateDoc,
  replaceDocPlaceholders,
  makeFilePublic,
  writeCellToSheet,
  sendGmailMessage,
}: CertificateMergeProps) {
  // Config state
  const [templateId, setTemplateId] = useState("");
  const [startRow, setStartRow] = useState(2);
  const [endRow, setEndRow] = useState(3);
  
  // Mappings
  const [nameCol, setNameCol] = useState(0);
  const [rankCol, setRankCol] = useState(1);
  const [classCol, setClassCol] = useState(2);
  const [emailCol, setEmailCol] = useState(3);
  const [targetCol, setTargetCol] = useState(4);

  // Email state
  const [emailSubject, setEmailSubject] = useState("Your Certificate and Rank Details");
  const [emailBody, setEmailBody] = useState(
    "Hi {Name}\n\nYour rank is {Rank}\n\nHere is your certificate {Drive link}\n\nWith regards,\nHarsh"
  );

  // Progress state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressLog, setProgressLog] = useState<MergeProgress[]>([]);
  const [currentProgressIdx, setCurrentProgressIdx] = useState<number | null>(null);

  const currentSheet = sheets[activeSheetIdx];
  const rows = currentSheet?.data || [];
  const colCount = rows[0]?.length || 4;

  const runMailMerge = async () => {
    if (!spreadsheetId) {
      onToast("error", "Google Sheet Required", "Please sync your workbook to Google Sheets (Step 1) before running the mail merge.");
      return;
    }

    const cleanTemplateId = extractDocId(templateId);

    if (!cleanTemplateId) {
      onToast("error", "Template ID Required", "Please enter a valid Google Doc template ID or URL.");
      return;
    }

    if (cleanTemplateId.toUpperCase() === "DOC TEMPLATE ID") {
      onToast("error", "Invalid Template ID", "You must replace 'DOC TEMPLATE ID' with a real Google Doc ID or URL from your Google Drive.");
      return;
    }

    if (startRow < 2 || endRow < startRow || endRow > rows.length) {
      onToast("error", "Invalid Row Range", `Please specify a valid row range between 2 and ${rows.length}.`);
      return;
    }

    setIsProcessing(true);
    const logs: MergeProgress[] = [];
    
    // Initialize logs for all target rows
    for (let r = startRow; r <= endRow; r++) {
      const rowArr = rows[r - 1];
      const nameVal = rowArr?.[nameCol]?.value || `Row ${r}`;
      logs.push({
        row: r,
        name: nameVal,
        status: "idle",
        message: "Waiting...",
      });
    }
    setProgressLog(logs);

    const updatedSheets = [...sheets];

    // Loop through the selected rows
    for (let idx = 0; idx < logs.length; idx++) {
      const currentLog = logs[idx];
      const rowIdx = currentLog.row - 1;
      const rowData = rows[rowIdx];
      
      if (!rowData) continue;

      setCurrentProgressIdx(idx);
      const updateStatus = (status: MergeProgress["status"], message: string) => {
        logs[idx] = { ...logs[idx], status, message };
        setProgressLog([...logs]);
      };

      try {
        const nameVal = rowData[nameCol]?.value || "";
        const rankVal = rowData[rankCol]?.value || "";
        const classVal = rowData[classCol]?.value || "";
        const emailVal = rowData[emailCol]?.value || "";
        const emailTrimmed = emailVal.trim();

        if (!emailTrimmed) {
          throw new Error("Missing recipient email address");
        }

        // Validate standard email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrimmed)) {
          throw new Error(`Invalid recipient email: "${emailVal}". Please check that Column ${getColLabel(emailCol)} contains valid email addresses, and your Start/End Row range does not include the headers (Row 1).`);
        }

        // 1. Copy Template Doc
        updateStatus("copying", "Copying Google Doc template...");
        const newDocName = `Certificate - ${nameVal}`;
        const copiedDocId = await copyTemplateDoc(cleanTemplateId, newDocName);

        // 2. Replace placeholders in Doc
        updateStatus("replacing", "Replacing placeholders in certificate...");
        const replacements = {
          "{Name}": nameVal,
          "{Rank}": rankVal,
          "{Class}": classVal,
        };
        await replaceDocPlaceholders(copiedDocId, replacements);

        // 3. Make file public & retrieve share link
        updateStatus("sharing", "Configuring sharing links in Drive...");
        const sharingLink = await makeFilePublic(copiedDocId);

        // 4. Write link back to Google Sheet
        updateStatus("writing", "Writing sharing link to spreadsheet...");
        const colLetter = getColLabel(targetCol);
        const cellRange = `'${currentSheet.name}'!${colLetter}${currentLog.row}`;

        // Construct HYPERLINK formula with personalized text (escaped for Google Sheets formula quotes)
        const personalizedLabel = emailBody
          .replace(/{Name}/g, nameVal)
          .replace(/{Rank}/g, rankVal)
          .replace(/{Class}/g, classVal)
          .replace(/{Drive link}/g, sharingLink)
          .replace(/"/g, '""');

        const hyperlinkFormula = `=HYPERLINK("${sharingLink}", "${personalizedLabel}")`;
        await writeCellToSheet(spreadsheetId, cellRange, hyperlinkFormula);

        // Update local sheet state grid
        const newSheetData = updatedSheets[activeSheetIdx].data.map((rArr) => rArr.map((c) => ({ ...c })));
        if (!newSheetData[rowIdx]) newSheetData[rowIdx] = [];
        newSheetData[rowIdx][targetCol] = { value: hyperlinkFormula, style: {} };
        updatedSheets[activeSheetIdx] = {
          ...updatedSheets[activeSheetIdx],
          data: newSheetData,
        };

        // 5. Send Loop Mail
        updateStatus("emailing", "Sending notification email...");
        const personalizedBody = emailBody
          .replace(/{Name}/g, nameVal)
          .replace(/{Rank}/g, rankVal)
          .replace(/{Class}/g, classVal)
          .replace(/{Drive link}/g, sharingLink);
        
        await sendGmailMessage(emailTrimmed, emailSubject, personalizedBody);

        updateStatus("success", "Completed successfully!");
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        updateStatus("error", errorMsg);
        console.error(`Mail merge error on row ${currentLog.row}:`, err);
      }
    }

    // Push the final sheet update locally to show links in grid and trigger save
    onSheetsChange(updatedSheets);
    setIsProcessing(false);
    setCurrentProgressIdx(null);
    onToast("success", "Mail Merge Completed", `Finished processing rows ${startRow} to ${endRow}.`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Description header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            background: "var(--at-accent-light)",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Award size={18} color="var(--at-accent)" />
        </div>
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--at-text)" }}>
            Certificate Generator
          </h3>
          <p style={{ fontSize: "11px", color: "var(--at-text-soft)", marginTop: "2px" }}>
            Generate Google Docs in Drive and email them to recipients.
          </p>
        </div>
      </div>

      <div className="section-divider" />

      {/* Main configuration panel */}
      {!isProcessing && progressLog.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Template Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label className="field-label" style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
              <FileText size={12} />
              Doc Template ID
            </label>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. 1uI_P7oV..."
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              title="Open your template Google Doc, copy the long ID code in the address bar, and paste it here."
            />
          </div>

          {/* Row selection bounds */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label className="field-label" style={{ marginBottom: "2px" }}>Start Row</label>
              <input
                type="number"
                className="field-input"
                min={2}
                max={rows.length}
                value={startRow}
                onChange={(e) => setStartRow(Math.max(2, Number(e.target.value)))}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label className="field-label" style={{ marginBottom: "2px" }}>End Row</label>
              <input
                type="number"
                className="field-input"
                min={startRow}
                max={rows.length}
                value={endRow}
                onChange={(e) => setEndRow(Math.max(startRow, Number(e.target.value)))}
              />
            </div>
          </div>

          <div className="section-divider" style={{ margin: "4px 0" }} />

          {/* Column mappings */}
          <h4 style={{ fontSize: "11px", fontWeight: 700, color: "var(--at-text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Column Mappings
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label className="field-label" style={{ marginBottom: "0px" }}>Name Placeholder</label>
              <select className="field-select" value={nameCol} onChange={(e) => setNameCol(Number(e.target.value))}>
                {Array.from({ length: colCount }).map((_, idx) => (
                  <option key={idx} value={idx}>Col {getColLabel(idx)} ({rows[0]?.[idx]?.value || "Empty"})</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label className="field-label" style={{ marginBottom: "0px" }}>Rank Placeholder</label>
              <select className="field-select" value={rankCol} onChange={(e) => setRankCol(Number(e.target.value))}>
                {Array.from({ length: colCount }).map((_, idx) => (
                  <option key={idx} value={idx}>Col {getColLabel(idx)} ({rows[0]?.[idx]?.value || "Empty"})</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label className="field-label" style={{ marginBottom: "0px" }}>Class Placeholder</label>
              <select className="field-select" value={classCol} onChange={(e) => setClassCol(Number(e.target.value))}>
                {Array.from({ length: colCount }).map((_, idx) => (
                  <option key={idx} value={idx}>Col {getColLabel(idx)} ({rows[0]?.[idx]?.value || "Empty"})</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label className="field-label" style={{ marginBottom: "0px" }}>Recipient Email</label>
              <select className="field-select" value={emailCol} onChange={(e) => setEmailCol(Number(e.target.value))}>
                {Array.from({ length: colCount }).map((_, idx) => (
                  <option key={idx} value={idx}>Col {getColLabel(idx)} ({rows[0]?.[idx]?.value || "Empty"})</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label className="field-label" style={{ marginBottom: "0px" }}>Write Link To</label>
              <select className="field-select" value={targetCol} onChange={(e) => setTargetCol(Number(e.target.value))}>
                {Array.from({ length: colCount }).map((_, idx) => (
                  <option key={idx} value={idx}>Col {getColLabel(idx)} ({rows[0]?.[idx]?.value || "Empty"})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="section-divider" style={{ margin: "4px 0" }} />

          {/* Email Settings */}
          <h4 style={{ fontSize: "11px", fontWeight: 700, color: "var(--at-text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Email Notification
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label className="field-label" style={{ marginBottom: "0px" }}>Subject</label>
              <input
                type="text"
                className="field-input"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label className="field-label" style={{ display: "flex", justifyContent: "space-between", marginBottom: "0px" }}>
                Body Template
                <span title="Placeholders: {Name}, {Rank}, {Class}, {Drive link}">
                  <HelpCircle size={10} style={{ opacity: 0.5 }} />
                </span>
              </label>
              <textarea
                className="field-input"
                rows={5}
                style={{ fontFamily: "inherit", fontSize: "12px", resize: "none" }}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
              />
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={runMailMerge}
            disabled={apiLoading}
            className="btn-primary"
            style={{
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {apiLoading ? (
              <RefreshCw size={14} className="spin" />
            ) : (
              <Play size={14} fill="white" />
            )}
            Run Certificate Mail Merge
          </button>
        </div>
      ) : (
        /* Progress Dashboard View */
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              padding: "10px",
              background: "var(--at-surface-2)",
              borderRadius: "6px",
              border: "1px solid var(--at-border)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isProcessing ? (
              <RefreshCw size={14} className="spin" color="var(--at-accent)" />
            ) : (
              <CheckCircle2 size={14} color="var(--clr-success)" />
            )}
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--at-text)" }}>
              {isProcessing ? "Processing mail merge batch..." : "Mail merge batch completed."}
            </span>
          </div>

          {/* Log List */}
          <div
            style={{
              maxHeight: "280px",
              overflowY: "auto",
              border: "1px solid var(--at-border)",
              borderRadius: "6px",
              background: "#fafafa",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {progressLog.map((log, idx) => {
              const isActive = idx === currentProgressIdx;
              const Icon = 
                log.status === "success" ? CheckCircle2 :
                log.status === "error" ? XCircle :
                isActive ? RefreshCw : HelpCircle;

              const statusColor = 
                log.status === "success" ? "var(--clr-success)" :
                log.status === "error" ? "#dc2626" :
                isActive ? "var(--at-accent)" : "#94a3b8";

              return (
                <div
                  key={log.row}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "8px 10px",
                    borderBottom: idx < progressLog.length - 1 ? "1px solid #eaeaea" : "none",
                    background: isActive ? "#eff6ff" : "transparent",
                  }}
                >
                  <Icon
                    size={14}
                    className={isActive ? "spin" : ""}
                    style={{ color: statusColor, flexShrink: 0, marginTop: "2px" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#1e293b" }}>
                        Row {log.row}: {log.name}
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: 600, color: statusColor }}>
                        {log.status}
                      </span>
                    </div>
                    <p style={{ fontSize: "10.5px", color: "#64748b", marginTop: "1px" }}>
                      {log.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {!isProcessing && (
            <button
              onClick={() => {
                setProgressLog([]);
                setIsProcessing(false);
              }}
              className="btn-secondary"
            >
              Reset Merge Form
            </button>
          )}
        </div>
      )}
    </div>
  );
}
