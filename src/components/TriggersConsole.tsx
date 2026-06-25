"use client";

import React, { useState } from "react";
import {
  Settings,
  Terminal,
  Trash2,
  ToggleLeft,
  ToggleRight,
  PlusCircle,
  Database,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getColLabel, ImportedSheet } from "./SpreadsheetGrid";

export interface Trigger {
  id: string;
  name: string;
  type: "row_added" | "cell_changed";
  isActive: boolean;
  sheetName: string;
  targetColumn?: number; // -1 means "Any Column"
  actionType: "auto_fill" | "log_only";
  actionColumn?: number;
  actionValueFormula?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  triggerName?: string;
  eventType: "row_added" | "cell_changed" | "manual_edit" | "system";
  sheetName: string;
  details: string;
  status: "success" | "warning" | "info";
}

interface TriggersConsoleProps {
  triggers: Trigger[];
  logs: LogEntry[];
  sheets: ImportedSheet[];
  activeSheetIdx: number;
  dbProvider: string;
  dbDetails: string;
  isTestingConnection: boolean;
  onAddTrigger: (trigger: Omit<Trigger, "id">) => void;
  onToggleTrigger: (id: string) => void;
  onDeleteTrigger: (id: string) => void;
  onClearLogs: () => void;
  onTestConnection: () => void;
  onSyncDb: () => void;
}

export function TriggersConsole({
  triggers,
  logs,
  sheets,
  activeSheetIdx,
  dbProvider,
  dbDetails,
  isTestingConnection,
  onAddTrigger,
  onToggleTrigger,
  onDeleteTrigger,
  onClearLogs,
  onTestConnection,
  onSyncDb,
}: TriggersConsoleProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"logs" | "triggers">("logs");
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // New Trigger Form State
  const [triggerName, setTriggerName] = useState("");
  const [eventType, setEventType] = useState<"row_added" | "cell_changed">("cell_changed");
  const [sheetName, setSheetName] = useState("All");
  const [targetColumn, setTargetColumn] = useState<number>(-1); // -1 is Any Column
  const [actionType, setActionType] = useState<"auto_fill" | "log_only">("log_only");
  const [actionColumn, setActionColumn] = useState<number>(0);
  const [actionValue, setActionValue] = useState("");
  
  const currentSheet = sheets[activeSheetIdx];
  const colCount = currentSheet?.data[0]?.length || 4;

  const handleSubmitTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerName.trim()) return;

    onAddTrigger({
      name: triggerName,
      type: eventType,
      isActive: true,
      sheetName,
      targetColumn: eventType === "cell_changed" ? targetColumn : undefined,
      actionType,
      actionColumn: actionType === "auto_fill" ? actionColumn : undefined,
      actionValueFormula: actionType === "auto_fill" ? actionValue : undefined,
    });

    // Reset Form
    setTriggerName("");
    setActionValue("");
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.details.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.sheetName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" || log.eventType === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className={`tg-console ${isOpen ? "tg-console--open" : "tg-console--closed"}`}>
      {/* Console Header */}
      <div className="tg-header" onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Terminal size={16} color="var(--at-accent)" />
          <span style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0" }}>
            Triggers & Logs
          </span>
          <span className="tg-badge">{triggers.length} Active Triggers</span>
          <span className={`tg-db-indicator tg-db-indicator--${dbProvider}`}>
            <Database size={12} />
            {dbProvider === "upstash_redis" ? "Upstash Redis" : dbProvider === "vercel_postgres" ? "Vercel Postgres" : "Local JSON File"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }} onClick={(e) => e.stopPropagation()}>
          <button 
            className={`tg-tab-btn ${activeTab === "logs" ? "tg-tab-btn--active" : ""}`}
            onClick={() => { setIsOpen(true); setActiveTab("logs"); }}
          >
            Change Log ({filteredLogs.length})
          </button>
          <button 
            className={`tg-tab-btn ${activeTab === "triggers" ? "tg-tab-btn--active" : ""}`}
            onClick={() => { setIsOpen(true); setActiveTab("triggers"); }}
          >
            Triggers Manager ({triggers.length})
          </button>
          
          <div className="tg-header-divider" />
          
          <button className="tg-icon-btn" onClick={() => setIsOpen(!isOpen)} title={isOpen ? "Collapse console" : "Expand console"}>
            {isOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {/* Console Body */}
      {isOpen && (
        <div className="tg-body">
          {/* Active Tab Content */}
          {activeTab === "logs" ? (
            <div className="tg-tab-content">
              {/* Logs Toolbar */}
              <div className="tg-toolbar">
                <div style={{ display: "flex", gap: "8px", flex: 1 }}>
                  <div className="tg-input-search">
                    <Search size={13} className="tg-search-icon" />
                    <input 
                      type="text" 
                      placeholder="Search change logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="tg-select-wrapper">
                    <Filter size={13} className="tg-filter-icon" />
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                      <option value="all">All Events</option>
                      <option value="cell_changed">Cell Changes</option>
                      <option value="row_added">Row Additions</option>
                      <option value="manual_edit">Manual Edits</option>
                      <option value="system">System Logs</option>
                    </select>
                  </div>
                </div>
                <button className="tg-btn tg-btn--danger" onClick={onClearLogs} disabled={logs.length === 0}>
                  <Trash2 size={13} />
                  Clear Logs
                </button>
              </div>

              {/* Logs Table */}
              <div className="tg-table-wrapper scrollbar-dark">
                {filteredLogs.length === 0 ? (
                  <div className="tg-empty-state">
                    <Terminal size={24} style={{ opacity: 0.3 }} />
                    <p>No change logs found. Edit cells or configure triggers to see them in action.</p>
                  </div>
                ) : (
                  <table className="tg-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Event</th>
                        <th>Sheet</th>
                        <th>Details</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className={`tg-row tg-row--${log.status}`}>
                          <td className="tg-td-time">{log.timestamp}</td>
                          <td>
                            <span className={`tg-event-badge tg-event-badge--${log.eventType}`}>
                              {log.eventType.replace("_", " ")}
                            </span>
                          </td>
                          <td className="tg-td-sheet">{log.sheetName}</td>
                          <td className="tg-td-details">
                            {log.triggerName && <strong style={{ color: "#38bdf8" }}>[{log.triggerName}] </strong>}
                            {log.details}
                          </td>
                          <td>
                            <span className={`tg-status-indicator tg-status-indicator--${log.status}`}>
                              {log.status === "success" && <CheckCircle2 size={11} />}
                              {log.status === "warning" && <AlertTriangle size={11} />}
                              {log.status === "info" && <Info size={11} />}
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="tg-tab-content tg-grid-2">
              {/* Left Column: Triggers List */}
              <div className="tg-card">
                <h3 className="tg-card-title">Configured Triggers</h3>
                <div className="tg-list scrollbar-dark">
                  {triggers.length === 0 ? (
                    <div className="tg-empty-state">
                      <Settings size={20} style={{ opacity: 0.3 }} />
                      <p>No triggers configured yet. Create one on the right.</p>
                    </div>
                  ) : (
                    triggers.map((trigger) => (
                      <div key={trigger.id} className={`tg-item ${!trigger.isActive ? "tg-item--inactive" : ""}`}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ color: "#f8fafc", fontSize: "13px" }}>{trigger.name}</strong>
                            <span className={`tg-event-badge tg-event-badge--${trigger.type}`}>
                              {trigger.type.replace("_", " ")}
                            </span>
                          </div>
                          <p className="tg-item-desc">
                            Scope: <span style={{ color: "#38bdf8" }}>{trigger.sheetName}</span>
                            {trigger.type === "cell_changed" && (
                              <>
                                {" "}· Target Col:{" "}
                                <span style={{ color: "#f59e0b" }}>
                                  {trigger.targetColumn === -1 ? "Any" : getColLabel(trigger.targetColumn!)}
                                </span>
                              </>
                            )}
                          </p>
                          <p className="tg-item-action">
                            Action:{" "}
                            {trigger.actionType === "auto_fill" ? (
                              <span>
                                Auto-fill Column <strong>{getColLabel(trigger.actionColumn!)}</strong> with{" "}
                                <code>{trigger.actionValueFormula}</code>
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>Log to console only</span>
                            )}
                          </p>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button 
                            className="tg-toggle-btn"
                            onClick={() => onToggleTrigger(trigger.id)}
                            title={trigger.isActive ? "Deactivate trigger" : "Activate trigger"}
                          >
                            {trigger.isActive ? (
                              <ToggleRight size={22} color="var(--clr-success)" />
                            ) : (
                              <ToggleLeft size={22} color="#475569" />
                            )}
                          </button>
                          <button 
                            className="tg-icon-btn tg-icon-btn--danger"
                            onClick={() => onDeleteTrigger(trigger.id)}
                            title="Delete trigger"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Trigger Builder Form */}
              <div className="tg-card">
                <h3 className="tg-card-title">Create Trigger</h3>
                <form onSubmit={handleSubmitTrigger} className="tg-form">
                  <div className="tg-form-group">
                    <label>Trigger Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Log products edit or Stamp changes" 
                      value={triggerName}
                      onChange={(e) => setTriggerName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="tg-form-row">
                    <div className="tg-form-group">
                      <label>Event Type</label>
                      <select 
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value as "row_added" | "cell_changed")}
                      >
                        <option value="cell_changed">Cell Value Changed</option>
                        <option value="row_added">Row Added</option>
                      </select>
                    </div>

                    <div className="tg-form-group">
                      <label>Target Sheet</label>
                      <select 
                        value={sheetName} 
                        onChange={(e) => setSheetName(e.target.value)}
                      >
                        <option value="All">All Sheets</option>
                        {sheets.map((s) => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {eventType === "cell_changed" && (
                    <div className="tg-form-group">
                      <label>Trigger on column</label>
                      <select 
                        value={targetColumn} 
                        onChange={(e) => setTargetColumn(Number(e.target.value))}
                      >
                        <option value={-1}>Any Column</option>
                        {Array.from({ length: colCount }).map((_, idx) => (
                          <option key={idx} value={idx}>Column {getColLabel(idx)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="tg-form-group">
                    <label>Action</label>
                    <select 
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value as "auto_fill" | "log_only")}
                    >
                      <option value="log_only">Write description to Change Log only</option>
                      <option value="auto_fill">Auto-fill another cell in the same row</option>
                    </select>
                  </div>

                  {actionType === "auto_fill" && (
                    <div className="tg-form-row">
                      <div className="tg-form-group">
                        <label>Target Write Column</label>
                        <select 
                          value={actionColumn}
                          onChange={(e) => setActionColumn(Number(e.target.value))}
                        >
                          {Array.from({ length: colCount }).map((_, idx) => (
                            <option key={idx} value={idx}>Column {getColLabel(idx)}</option>
                          ))}
                        </select>
                      </div>

                      <div className="tg-form-group">
                        <label>Value / Template</label>
                        <input 
                          type="text" 
                          placeholder="e.g. {{timestamp}} or ROW-{{row}}" 
                          value={actionValue}
                          onChange={(e) => setActionValue(e.target.value)}
                          required
                          title="Templates: {{row}} - row number, {{timestamp}} - current time, or plain text."
                        />
                      </div>
                    </div>
                  )}

                  <button type="submit" className="tg-submit-btn">
                    <PlusCircle size={14} />
                    Add Trigger Rule
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Console Footer / Database Status Bar */}
          <div className="tg-footer">
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              <strong>Config details:</strong> {dbDetails}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                className="tg-btn tg-btn--secondary" 
                onClick={onTestConnection}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? <RefreshCw size={12} className="spin" /> : <Database size={12} />}
                Test Database Connection
              </button>
              <button className="tg-btn" onClick={onSyncDb}>
                <RefreshCw size={12} />
                Save & Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
