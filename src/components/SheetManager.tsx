"use client";

import React, { useState } from "react";
import { RightSidebar } from "@/components/RightSidebar";
import { CreateSheet } from "@/components/steps/CreateSheet";
import { HideTabs } from "@/components/steps/HideTabs";
import { ShareSheet } from "@/components/steps/ShareSheet";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { useSheetsApi, CreatedSheet } from "@/hooks/useSheetsApi";
import { SpreadsheetGrid, ImportedSheet, getColLabel } from "@/components/SpreadsheetGrid";
import { CellControlPanel } from "@/components/CellControlPanel";
import { TriggersConsole, Trigger, LogEntry } from "@/components/TriggersConsole";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  CheckCircle2,
  Lock,
  ChevronRight,
  ChevronLeft,
  Eye,
  Share2,
  Plus,
  Table,
  Upload,
  Download,
  CloudUpload,
  RefreshCw,
} from "lucide-react";

type Step = 1 | 2 | 3;

const STEPS = [
  {
    id: 1 as Step,
    label: "Create Sheet",
    icon: Table,
    sidebarTitle: "New Sheet Setup",
  },
  {
    id: 2 as Step,
    label: "Tab Visibility",
    icon: Eye,
    sidebarTitle: "Manage Tab Visibility",
  },
  {
    id: 3 as Step,
    label: "Share",
    icon: Share2,
    sidebarTitle: "Share Your Sheet",
  },
];

export function SheetManager() {
  const [step, setStep] = useState<Step>(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createdSheet, setCreatedSheet] = useState<CreatedSheet | null>(null);
  const [sheetName, setSheetName] = useState("");

  // New Excel Import / Edit States
  const [importedSheets, setImportedSheets] = useState<ImportedSheet[] | null>(
    null,
  );
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [sidebarMode, setSidebarMode] = useState<"step" | "cell">("step");
  const [importedFileName, setImportedFileName] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { toasts, dismiss, toast } = useToast();
  const {
    isLoading,
    createSheet,
    createSheetFromImport,
    hideTabs,
    shareSheet,
  } = useSheetsApi();

  // Triggers and DB States
  const [triggers, setTriggers] = useState<Trigger[]>([
    {
      id: "t-default-1",
      name: "Auto Timestamp Product Edit",
      type: "cell_changed",
      isActive: true,
      sheetName: "All",
      targetColumn: 0, // Column A (usually Product)
      actionType: "auto_fill",
      actionColumn: 2, // Column C (Last Modified)
      actionValueFormula: "{{timestamp}}",
    },
    {
      id: "t-default-2",
      name: "Log Row Additions",
      type: "row_added",
      isActive: true,
      sheetName: "All",
      actionType: "log_only",
    }
  ]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dbProvider, setDbProvider] = useState<string>("local_json_file");
  const [dbDetails, setDbDetails] = useState<string>("Initializing storage connection...");
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const isExecutingTriggersRef = React.useRef(false);

  const testDbConnection = async (silent = false) => {
    if (!silent) setIsTestingConnection(true);
    try {
      const res = await fetch("/api/db?test=true");
      if (res.ok) {
        const info = await res.json();
        setDbProvider(info.provider);
        setDbDetails(info.details);
        if (!silent) {
          toast("success", "Connection Successful!", info.details);
        }
      } else {
        throw new Error("Failed to contact database route");
      }
    } catch (err) {
      setDbProvider("in_memory");
      setDbDetails("Error connecting. Falling back to in-memory temporary storage.");
      if (!silent) {
        toast("error", "Connection Failed", "Could not connect to database route.");
      }
    } finally {
      if (!silent) setIsTestingConnection(false);
    }
  };

  const saveDbState = async (
    currentSheets: ImportedSheet[] | null,
    currentTriggers: Trigger[],
    currentLogs: LogEntry[]
  ) => {
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheets: currentSheets || [],
          triggers: currentTriggers,
          logs: currentLogs,
        }),
      });
      if (!res.ok) {
        console.warn("Failed to sync state to database API");
      }
    } catch (err) {
      console.warn("Failed to save state to DB API:", err);
    }
  };

  // Load database state on mount
  React.useEffect(() => {
    async function loadDbState() {
      try {
        const res = await fetch("/api/db");
        if (res.ok) {
          const data = await res.json();
          if (data.sheets && data.sheets.length > 0) {
            setImportedSheets(data.sheets);
            setImportedFileName(data.sheets[0]?.name || "Restored Workbook");
          }
          if (data.triggers && data.triggers.length > 0) {
            setTriggers(data.triggers);
          }
          if (data.logs) {
            setLogs(data.logs);
          }
        }
      } catch (err) {
        console.error("Failed to load initial DB state:", err);
      }
      
      testDbConnection(true);
    }
    loadDbState();
  }, []);

  // Triggers Interceptor Logic
  const handleSheetsChange = (nextSheets: ImportedSheet[] | null) => {
    if (!nextSheets) {
      setImportedSheets(null);
      saveDbState(null, triggers, logs);
      return;
    }

    if (isExecutingTriggersRef.current) {
      setImportedSheets(nextSheets);
      return;
    }

    const prevSheets = importedSheets;
    setImportedSheets(nextSheets);

    if (!prevSheets || prevSheets.length === 0 || nextSheets.length === 0) {
      saveDbState(nextSheets, triggers, logs);
      return;
    }

    const activeSheet = nextSheets[activeSheetIdx];
    const prevSheet = prevSheets[activeSheetIdx];

    if (!activeSheet || !prevSheet) {
      saveDbState(nextSheets, triggers, logs);
      return;
    }

    let newLogs: LogEntry[] = [...logs];
    let sheetModified = false;
    const finalSheets = [...nextSheets];

    isExecutingTriggersRef.current = true;

    try {
      // 1. Check Row Added Trigger
      const prevRowCount = prevSheet.data.length;
      const nextRowCount = activeSheet.data.length;

      if (nextRowCount > prevRowCount) {
        let detectedAddedRow = -1;
        for (let r = 0; r < nextRowCount; r++) {
          if (r >= prevRowCount) {
            detectedAddedRow = r;
            break;
          }
          const prevRow = prevSheet.data[r];
          const nextRow = activeSheet.data[r];
          const isNextEmpty = nextRow.every(c => c.value === "");
          const isPrevEmpty = prevRow.every(c => c.value === "");
          if (isNextEmpty && !isPrevEmpty) {
            detectedAddedRow = r;
            break;
          }
        }
        if (detectedAddedRow === -1) {
          detectedAddedRow = nextRowCount - 1;
        }

        const manualLog: LogEntry = {
          id: `log-row-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          eventType: "row_added",
          sheetName: activeSheet.name,
          details: `Row ${detectedAddedRow + 1} was added.`,
          status: "info",
        };
        newLogs = [manualLog, ...newLogs];

        const activeRowTriggers = triggers.filter(
          (t) => t.isActive && t.type === "row_added" && (t.sheetName === "All" || t.sheetName === activeSheet.name)
        );

        activeRowTriggers.forEach((trigger) => {
          const runLog: LogEntry = {
            id: `log-tr-${Date.now()}-${Math.random()}`,
            timestamp: new Date().toLocaleTimeString(),
            triggerName: trigger.name,
            eventType: "row_added",
            sheetName: activeSheet.name,
            details: `Executing trigger "${trigger.name}".`,
            status: "success",
          };

          if (trigger.actionType === "auto_fill" && trigger.actionColumn !== undefined) {
            const colIdx = trigger.actionColumn;
            const template = trigger.actionValueFormula || "";
            const val = template
              .replace("{{row}}", String(detectedAddedRow + 1))
              .replace("{{timestamp}}", new Date().toLocaleTimeString());

            const updatedData = finalSheets[activeSheetIdx].data.map((rowArr) => rowArr.map((c) => ({ ...c })));
            if (updatedData[detectedAddedRow]) {
              updatedData[detectedAddedRow][colIdx] = {
                ...updatedData[detectedAddedRow][colIdx],
                value: val,
              };
              finalSheets[activeSheetIdx] = {
                ...finalSheets[activeSheetIdx],
                data: updatedData,
              };
              sheetModified = true;
              runLog.details += ` Auto-filled Column ${getColLabel(colIdx)} of Row ${detectedAddedRow + 1} with "${val}".`;
            }
          } else {
            runLog.details += ` Logged event.`;
          }
          newLogs = [runLog, ...newLogs];
        });
      }

      // 2. Check Cell Changed Trigger
      else if (nextRowCount === prevRowCount) {
        const prevColCount = prevSheet.data[0]?.length || 0;
        const nextColCount = activeSheet.data[0]?.length || 0;

        if (nextColCount === prevColCount) {
          let changedCell: { row: number; col: number; prevVal: string; newVal: string } | null = null;
          for (let r = 0; r < nextRowCount; r++) {
            for (let c = 0; c < nextColCount; c++) {
              const pVal = prevSheet.data[r][c]?.value ?? "";
              const nVal = activeSheet.data[r][c]?.value ?? "";
              if (pVal !== nVal) {
                changedCell = { row: r, col: c, prevVal: pVal, newVal: nVal };
                break;
              }
            }
            if (changedCell) break;
          }

          if (changedCell) {
            const { row: rIdx, col: cIdx, prevVal, newVal } = changedCell;
            const cellRef = `${getColLabel(cIdx)}${rIdx + 1}`;

            const editLog: LogEntry = {
              id: `log-edit-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              eventType: "manual_edit",
              sheetName: activeSheet.name,
              details: `Cell ${cellRef} changed from "${prevVal}" to "${newVal}".`,
              status: "info",
            };
            newLogs = [editLog, ...newLogs];

            const activeCellTriggers = triggers.filter(
              (t) =>
                t.isActive &&
                t.type === "cell_changed" &&
                (t.sheetName === "All" || t.sheetName === activeSheet.name) &&
                (t.targetColumn === -1 || t.targetColumn === cIdx)
            );

            activeCellTriggers.forEach((trigger) => {
              const runLog: LogEntry = {
                id: `log-tr-${Date.now()}-${Math.random()}`,
                timestamp: new Date().toLocaleTimeString(),
                triggerName: trigger.name,
                eventType: "cell_changed",
                sheetName: activeSheet.name,
                details: `Executing trigger "${trigger.name}".`,
                status: "success",
              };

              if (trigger.actionType === "auto_fill" && trigger.actionColumn !== undefined) {
                const colIdx = trigger.actionColumn;
                
                if (colIdx === cIdx) {
                  runLog.status = "warning";
                  runLog.details += ` Skipping action to prevent feedback loop (target cell matches changed cell).`;
                  newLogs = [runLog, ...newLogs];
                  return;
                }

                const template = trigger.actionValueFormula || "";
                const val = template
                  .replace("{{row}}", String(rIdx + 1))
                  .replace("{{timestamp}}", new Date().toLocaleTimeString())
                  .replace("{{prev}}", prevVal)
                  .replace("{{value}}", newVal);

                const updatedData = finalSheets[activeSheetIdx].data.map((rowArr) => rowArr.map((c) => ({ ...c })));
                if (updatedData[rIdx]) {
                  updatedData[rIdx][colIdx] = {
                    ...updatedData[rIdx][colIdx],
                    value: val,
                  };
                  finalSheets[activeSheetIdx] = {
                    ...finalSheets[activeSheetIdx],
                    data: updatedData,
                  };
                  sheetModified = true;
                  runLog.details += ` Auto-filled Column ${getColLabel(colIdx)} of Row ${rIdx + 1} with "${val}".`;
                }
              } else {
                runLog.details += ` Logged change.`;
              }
              newLogs = [runLog, ...newLogs];
            });
          }
        }
      }
    } catch (err) {
      console.error("Error executing triggers:", err);
    } finally {
      isExecutingTriggersRef.current = false;
    }

    if (sheetModified) {
      setImportedSheets(finalSheets);
    }
    setLogs(newLogs);
    saveDbState(sheetModified ? finalSheets : nextSheets, triggers, newLogs);
  };

  const handleAddTrigger = (newTr: Omit<Trigger, "id">) => {
    const trigger: Trigger = {
      ...newTr,
      id: `trigger-${Date.now()}`,
    };
    const updated = [...triggers, trigger];
    setTriggers(updated);
    
    const log: LogEntry = {
      id: `log-tr-create-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      eventType: "system",
      sheetName: "System",
      details: `Trigger rule "${trigger.name}" was created.`,
      status: "info",
    };
    const nextLogs = [log, ...logs];
    setLogs(nextLogs);
    saveDbState(importedSheets, updated, nextLogs);
    toast("success", "Trigger Created", `"${trigger.name}" is now active.`);
  };

  const handleToggleTrigger = (id: string) => {
    const updated = triggers.map((t) => {
      if (t.id === id) {
        const nextState = !t.isActive;
        const log: LogEntry = {
          id: `log-tr-toggle-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          eventType: "system",
          sheetName: "System",
          details: `Trigger rule "${t.name}" was ${nextState ? "activated" : "deactivated"}.`,
          status: "info",
        };
        setLogs((prev) => [log, ...prev]);
        return { ...t, isActive: nextState };
      }
      return t;
    });
    setTriggers(updated);
    saveDbState(importedSheets, updated, logs);
  };

  const handleDeleteTrigger = (id: string) => {
    const tToDelete = triggers.find((t) => t.id === id);
    if (!tToDelete) return;
    const updated = triggers.filter((t) => t.id !== id);
    setTriggers(updated);
    
    const log: LogEntry = {
      id: `log-tr-del-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      eventType: "system",
      sheetName: "System",
      details: `Trigger rule "${tToDelete.name}" was deleted.`,
      status: "info",
    };
    const nextLogs = [log, ...logs];
    setLogs(nextLogs);
    saveDbState(importedSheets, updated, nextLogs);
    toast("success", "Trigger Deleted", `"${tToDelete.name}" was removed.`);
  };

  const handleClearLogs = () => {
    setLogs([]);
    saveDbState(importedSheets, triggers, []);
    toast("success", "Logs Cleared", "Change log history has been reset.");
  };

  const handleSyncDb = () => {
    saveDbState(importedSheets, triggers, logs);
    toast("success", "Synced", "Manual save triggered. All data pushed to database.");
  };

  const reachedStep = createdSheet ? (step >= 3 ? 3 : step) : 1;

  const handleImportExcel = (sheets: ImportedSheet[], fileName: string) => {
    setImportedSheets(sheets);
    setImportedFileName(fileName);
    setActiveSheetIdx(0);
    setSelectedCell(null);
    setSidebarMode("step");
    setIsSidebarCollapsed(false);
    setIsSyncing(false);
  };

  const handleCellSelect = (cell: { row: number; col: number } | null) => {
    setSelectedCell(cell);
    if (cell) {
      setSidebarMode("cell");
      setSidebarOpen(true);
      setIsSidebarCollapsed(false);
    }
  };

  const handleExportExcel = () => {
    if (!importedSheets) return;
    try {
      const wb = XLSX.utils.book_new();
      importedSheets.forEach((sheet) => {
        const rawRows = sheet.data.map((row) => row.map((c) => c.value));
        const ws = XLSX.utils.aoa_to_sheet(rawRows);
        if (sheet.cols) {
          ws["!cols"] = sheet.cols.map((c) => ({ hidden: !!c?.hidden }));
        }
        if (sheet.rows) {
          ws["!rows"] = sheet.rows.map((r) => ({ hidden: !!r?.hidden }));
        }
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      });
      XLSX.writeFile(wb, `${importedFileName || "spreadsheet"}_edited.xlsx`);
      toast(
        "success",
        "Spreadsheet exported!",
        "Your edits have been saved to a new Excel file.",
      );
    } catch (err) {
      toast("error", "Export failed", "Could not export sheet file.");
      console.error(err);
    }
  };

  const handleSyncToGoogle = async () => {
    if (!importedSheets) return;
    setIsSyncing(true);
    const name = importedFileName || "Synced Sheet";
    try {
      const formatted = importedSheets.map((s) => ({
        name: s.name,
        data: s.data.map((row) => row.map((c) => c.value)),
        cols: s.cols?.map((c) => ({ hidden: !!c?.hidden })),
        rows: s.rows?.map((r) => ({ hidden: !!r?.hidden })),
      }));

      const sheet = await createSheetFromImport(name, formatted);
      setCreatedSheet(sheet);
      setSheetName(name);
      setStep(2);
      setSidebarMode("step");
      setSidebarOpen(false);
      setIsSidebarCollapsed(false);
      toast(
        "success",
        "Synced successfully!",
        `Created Google Sheet "${name}" with ${formatted.length} tab(s).`,
      );
      setTimeout(() => setSidebarOpen(true), 120);
    } catch (err) {
      toast(
        "error",
        "Sync failed",
        "Please sign in and authorize the Google API.",
      );
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreated = (sheet: CreatedSheet, name: string) => {
    setCreatedSheet(sheet);
    setSheetName(name);
    setStep(2);
    setSidebarOpen(false);
    setIsSidebarCollapsed(false);
    setTimeout(() => setSidebarOpen(true), 120);
  };

  const handleTabsHidden = () => {
    setStep(3);
    setSidebarOpen(false);
    setIsSidebarCollapsed(false);
    setTimeout(() => setSidebarOpen(true), 120);
  };

  const openSidebarForStep = (s: Step) => {
    setStep(s);
    setSidebarOpen(true);
    setIsSidebarCollapsed(false);
  };

  const currentStepMeta = STEPS.find((s) => s.id === step)!;

  /* ─── Sidebar content per step ───────────────────────────────── */
  const sidebarContent = () => {
    if (sidebarMode === "cell" && selectedCell && importedSheets) {
      return (
        <CellControlPanel
          selectedCell={selectedCell}
          sheets={importedSheets}
          activeSheetIdx={activeSheetIdx}
          onSheetsChange={handleSheetsChange}
          onCloseCellPanel={() => {
            setSidebarMode("step");
            setSelectedCell(null);
          }}
        />
      );
    }

    if (step === 1) {
      return (
        <CreateSheet
          onCreated={handleCreated}
          createSheet={createSheet}
          isLoading={isLoading}
          onToast={toast}
          onImportExcel={handleImportExcel}
        />
      );
    }
    if (step === 2 && createdSheet) {
      return (
        <HideTabs
          tabs={createdSheet.tabs}
          spreadsheetId={createdSheet.spreadsheetId}
          hideTabs={hideTabs}
          isLoading={isLoading}
          onDone={handleTabsHidden}
          onToast={toast}
        />
      );
    }
    if (step === 3 && createdSheet) {
      return (
        <ShareSheet
          spreadsheetId={createdSheet.spreadsheetId}
          shareSheet={shareSheet}
          isLoading={isLoading}
          onToast={toast}
        />
      );
    }
    return null;
  };

  /* ─── Main content per step ──────────────────────────────────── */
  const mainContent = () => {
    if (importedSheets) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            width: "100%",
            gap: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--at-text)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileSpreadsheet size={16} color="var(--at-accent)" />
                Local Workbook:{" "}
                <span style={{ color: "var(--at-accent)" }}>
                  {importedFileName}
                </span>
              </h2>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--at-text-soft)",
                  marginTop: "2px",
                }}
              >
                Double-click cells to edit inline, or single-click to format and
                edit in the sidebar.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={handleExportExcel}
                className="tbl-ctrl-btn"
                style={{
                  padding: "5px 12px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Download size={13} />
                Export Excel
              </button>
              <button
                onClick={handleSyncToGoogle}
                disabled={isSyncing}
                className="btn-primary"
                style={{
                  padding: "5px 12px",
                  width: "auto",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "var(--clr-success)",
                  boxShadow: "none",
                }}
              >
                {isSyncing ? (
                  <RefreshCw size={13} className="spin" />
                ) : (
                  <CloudUpload size={13} />
                )}
                Sync to Google Sheets
              </button>
              <button
                onClick={() => {
                  const confirmMsg = createdSheet
                    ? "Are you sure you want to close this spreadsheet? All wizard progress will be reset."
                    : "Are you sure you want to close this local spreadsheet? Any unsaved edits will be lost.";
                  if (confirm(confirmMsg)) {
                    setImportedSheets(null);
                    setImportedFileName("");
                    setSelectedCell(null);
                    setSidebarMode("step");
                    setIsSyncing(false);
                    setCreatedSheet(null);
                    setStep(1);
                  }
                }}
                className="tbl-ctrl-btn"
                style={{
                  color: "#b91c1c",
                  borderColor: "#fca5a5",
                  fontSize: "12px",
                  padding: "5px 12px",
                }}
              >
                Close Spreadsheet
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <SpreadsheetGrid
                sheets={importedSheets}
                activeSheetIdx={activeSheetIdx}
                selectedCell={selectedCell}
                onSheetsChange={handleSheetsChange}
                onActiveSheetIdxChange={setActiveSheetIdx}
                onSelectedCellChange={handleCellSelect}
                isSyncing={isSyncing}
                onSyncToGoogle={handleSyncToGoogle}
                onExportExcel={handleExportExcel}
              />
            </div>
            
            <TriggersConsole
              triggers={triggers}
              logs={logs}
              sheets={importedSheets}
              activeSheetIdx={activeSheetIdx}
              dbProvider={dbProvider}
              dbDetails={dbDetails}
              isTestingConnection={isTestingConnection}
              onAddTrigger={handleAddTrigger}
              onToggleTrigger={handleToggleTrigger}
              onDeleteTrigger={handleDeleteTrigger}
              onClearLogs={handleClearLogs}
              onTestConnection={() => testDbConnection(false)}
              onSyncDb={handleSyncDb}
            />
          </div>
        </div>
      );
    }

    /* Step 1 idle — nothing created yet */
    if (!createdSheet) {
      return (
        <div className="at-idle-state">
          <div className="at-idle-icon">
            <FileSpreadsheet
              size={28}
              color="var(--at-accent)"
              strokeWidth={1.5}
            />
          </div>
          <h2 className="at-idle-title">No sheet yet</h2>
          <p className="at-idle-desc">
            Create a Google Sheet, configure tab visibility, or import a local
            Excel/CSV to edit here.
          </p>
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              className="at-cta-btn"
              onClick={() => openSidebarForStep(1)}
            >
              <Plus size={14} />
              Create new sheet
            </button>
            <label
              className="at-cta-btn at-cta-btn--secondary"
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Upload size={14} />
              Import Excel/CSV
              <input
                type="file"
                accept=".xlsx, .xls, .csv, .tsv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    try {
                      const data = evt.target?.result;
                      const workbook = XLSX.read(data, { type: "array" });
                      const parsedSheets = workbook.SheetNames.map((name) => {
                        const sheet = workbook.Sheets[name];
                        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
                          header: 1,
                          defval: "",
                        });
                        const grid = rawRows.map((row) =>
                          row.map((val) => ({
                            value: String(val ?? ""),
                            style: {},
                          })),
                        );
                        if (grid.length === 0) {
                          grid.push([{ value: "", style: {} }]);
                        }

                        // Parse hidden columns
                        const colCount = grid[0]?.length || 0;
                        const cols = Array(colCount)
                          .fill(null)
                          .map((_, colIdx) => ({
                            hidden: !!sheet["!cols"]?.[colIdx]?.hidden,
                          }));

                        // Parse hidden rows
                        const rowCount = grid.length;
                        const rows = Array(rowCount)
                          .fill(null)
                          .map((_, rowIdx) => ({
                            hidden: !!sheet["!rows"]?.[rowIdx]?.hidden,
                          }));

                        return { name, data: grid, cols, rows };
                      });
                      if (parsedSheets.length > 0) {
                        handleImportExcel(
                          parsedSheets,
                          file.name.replace(/\.[^/.]+$/, ""),
                        );
                        toast(
                          "success",
                          "Spreadsheet imported!",
                          `${file.name} loaded successfully.`,
                        );
                      }
                    } catch (err) {
                      toast(
                        "error",
                        "Failed to parse file",
                        "Please verify it is a valid spreadsheet.",
                      );
                    }
                  };
                  reader.readAsArrayBuffer(file);
                }}
              />
            </label>
          </div>
        </div>
      );
    }

    /* Steps 2 & 3 — sheet exists, show summary */
    return (
      <div style={{ maxWidth: 680, width: "100%" }}>
        {/* Summary cards */}
        <div className="at-summary-grid">
          <div className="at-summary-card">
            <span className="at-summary-card-label">Sheet name</span>
            <span className="at-summary-card-value truncate">{sheetName}</span>
          </div>
          <div className="at-summary-card">
            <span className="at-summary-card-label">Tabs</span>
            <span className="at-summary-card-value">
              {createdSheet.tabs.length} sheets
            </span>
          </div>
          <div className="at-summary-card">
            <span className="at-summary-card-label">Status</span>
            <span
              className="at-summary-card-value"
              style={{
                color: step >= 3 ? "var(--clr-success)" : "var(--at-accent)",
              }}
            >
              {step === 2 ? "Configuring visibility" : "Ready to share"}
            </span>
          </div>
        </div>

        {/* Progress steps */}
        <div
          style={{
            background: "var(--at-surface)",
            border: "1px solid var(--at-border)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {STEPS.map((s, idx) => {
            const isDone = s.id < step;
            const isActive = s.id === step;
            const isLocked = s.id > step;
            const Icon = s.icon;

            return (
              <div
                key={s.id}
                onClick={() => {
                  if (!isLocked) openSidebarForStep(s.id);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 18px",
                  borderBottom:
                    idx < STEPS.length - 1
                      ? "1px solid var(--at-border-light)"
                      : "none",
                  cursor: isLocked ? "default" : "pointer",
                  background: isActive
                    ? "var(--at-accent-light)"
                    : "transparent",
                  transition: "background 0.15s",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isLocked && !isActive)
                    e.currentTarget.style.background = "var(--at-tab-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                {/* Status dot */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    background: isDone
                      ? "var(--clr-success-bg)"
                      : isActive
                        ? "var(--at-accent-light)"
                        : "var(--at-bg)",
                    border: `1.5px solid ${
                      isDone
                        ? "var(--clr-success-border)"
                        : isActive
                          ? "#c7dffe"
                          : "var(--at-border)"
                    }`,
                  }}
                >
                  {isDone ? (
                    <CheckCircle2
                      size={14}
                      color="var(--clr-success)"
                      strokeWidth={2.5}
                    />
                  ) : isActive ? (
                    <Icon size={13} color="var(--at-accent)" strokeWidth={2} />
                  ) : (
                    <Lock
                      size={12}
                      color="var(--at-text-soft)"
                      strokeWidth={2}
                    />
                  )}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      color: isLocked
                        ? "var(--at-text-soft)"
                        : isActive
                          ? "var(--at-accent)"
                          : "var(--at-text)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {s.label}
                  </p>
                  {isDone && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--clr-success)",
                        marginTop: 1,
                        fontWeight: 500,
                      }}
                    >
                      Completed
                    </p>
                  )}
                  {isActive && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--at-accent)",
                        marginTop: 1,
                        fontWeight: 500,
                      }}
                    >
                      In progress · click to open panel
                    </p>
                  )}
                </div>

                {/* Chevron */}
                {!isLocked && (
                  <ChevronRight
                    size={14}
                    color={
                      isActive ? "var(--at-accent)" : "var(--at-text-soft)"
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Open sheet link */}
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <a
            href={createdSheet.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              color: "var(--at-accent)",
              textDecoration: "none",
              fontWeight: 500,
              padding: "5px 10px",
              borderRadius: 5,
              border: "1px solid #c7dffe",
              background: "var(--at-accent-light)",
              transition: "all 0.14s",
            }}
          >
            <FileSpreadsheet size={12} />
            View in Google Sheets
          </a>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="at-shell">
        {/* ── Top Bar ─────────────────────────────────────────────── */}
        <header className="at-topbar">
          {/* Logo zone */}
          <div className="at-logo-zone">
            <div className="at-logo-icon">
              <FileSpreadsheet size={15} color="#fff" strokeWidth={2} />
            </div>
            <span className="at-logo-name">Sheet Manager</span>
          </div>

          {/* Step tabs */}
          <nav className="at-tabs-zone" aria-label="Steps">
            {STEPS.map((s) => {
              const isDone = createdSheet ? s.id < step : false;
              const isActive = s.id === step;
              const isLocked = !createdSheet && s.id > 1;
              const Icon = s.icon;

              return (
                <button
                  key={s.id}
                  className={`at-tab${isActive ? " at-tab--active" : ""}`}
                  onClick={() => {
                    if (!isLocked) {
                      openSidebarForStep(s.id);
                      setSidebarMode("step");
                      setSelectedCell(null);
                    }
                  }}
                  disabled={isLocked}
                  title={
                    isLocked ? "Complete the previous step first" : undefined
                  }
                  aria-current={isActive ? "step" : undefined}
                >
                  {/* Badge */}
                  <span
                    className={`at-tab-badge ${
                      isDone
                        ? "at-tab-badge--done"
                        : isActive
                          ? "at-tab-badge--active"
                          : "at-tab-badge--locked"
                    }`}
                  >
                    {isDone ? <CheckCircle2 size={10} strokeWidth={3} /> : s.id}
                  </span>
                  <Icon size={13} strokeWidth={1.75} />
                  {s.label}
                </button>
              );
            })}
          </nav>

          {/* Actions zone */}
          <div className="at-actions-zone">
            <button
              className={`at-cta-btn${sidebarOpen && !isSidebarCollapsed ? " at-cta-btn--secondary" : ""}`}
              style={{ width: "auto", fontSize: 12, padding: "5px 12px" }}
              onClick={() => {
                if (sidebarOpen) {
                  if (isSidebarCollapsed) {
                    setIsSidebarCollapsed(false);
                  } else {
                    setSidebarOpen(false);
                    if (sidebarMode === "cell") {
                      setSidebarMode("step");
                      setSelectedCell(null);
                    }
                  }
                } else {
                  setSidebarOpen(true);
                  setIsSidebarCollapsed(false);
                }
              }}
            >
              {sidebarOpen && !isSidebarCollapsed
                ? "Close panel"
                : sidebarMode === "cell"
                  ? "Cell Editor"
                  : currentStepMeta.label}
            </button>
          </div>
        </header>

        {/* ── Subbar ──────────────────────────────────────────────── */}
        {createdSheet && (
          <div className="at-subbar">
            <span className="at-subbar-label">Working on</span>
            <div className="at-subbar-divider" />
            <span className="at-subbar-chip">
              <FileSpreadsheet size={10} />
              {sheetName}
            </span>
            <div style={{ flex: 1 }} />
            <span
              style={{
                fontSize: 11,
                color: "var(--at-text-soft)",
                fontWeight: 500,
              }}
            >
              Step {step} of {STEPS.length}
            </span>
          </div>
        )}

        {/* ── Body: Content + Sidebar ──────────────────────────────── */}
        <div className="at-body" style={{ position: "relative" }}>
          {/* Main content */}
          <main className="at-content">{mainContent()}</main>

          {/* Floating collapse/uncollapse button */}
          {sidebarOpen && (
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              style={{
                position: "absolute",
                right: isSidebarCollapsed ? "0px" : "360px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 100,
                width: "20px",
                height: "48px",
                background: "var(--at-surface)",
                border: "1px solid var(--at-border)",
                borderRight: "none",
                borderRadius: "6px 0 0 6px",
                boxShadow: "-2px 0 6px rgba(0, 0, 0, 0.04)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--at-text-soft)",
                transition: "right 0.28s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s, color 0.15s",
                outline: "none",
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--at-accent)";
                e.currentTarget.style.background = "var(--at-surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--at-text-soft)";
                e.currentTarget.style.background = "var(--at-surface)";
              }}
              title={isSidebarCollapsed ? "Expand panel" : "Collapse panel"}
            >
              {isSidebarCollapsed ? <ChevronLeft size={14} strokeWidth={2.5} /> : <ChevronRight size={14} strokeWidth={2.5} />}
            </button>
          )}

          {/* Right sidebar */}
          <RightSidebar
            open={sidebarOpen && !isSidebarCollapsed}
            onClose={() => {
              setSidebarOpen(false);
              setIsSidebarCollapsed(false);
              if (sidebarMode === "cell") {
                setSidebarMode("step");
                setSelectedCell(null);
              }
            }}
            title={
              sidebarMode === "cell" && selectedCell
                ? `Cell ${String.fromCharCode(65 + selectedCell.col)}${selectedCell.row + 1} Editor`
                : currentStepMeta.sidebarTitle
            }
          >
            {sidebarContent()}
          </RightSidebar>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
