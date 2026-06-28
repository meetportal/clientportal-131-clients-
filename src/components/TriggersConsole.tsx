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
  MousePointerClick,
  Copy,
  Globe,
  Lock,
  Key,
  Eye,
  EyeOff,
  Code,
  Activity,
  Send,
} from "lucide-react";
import { getColLabel, ImportedSheet, SheetApiSettings, SheetWebhookSettings } from "./SpreadsheetGrid";
import { ClickAnalyticsPanel } from "@/components/ClickAnalyticsPanel";

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
  onUpdateSheetApiSettings: (sheetIdx: number, settings: SheetApiSettings) => void;
  onUpdateSheetWebhookSettings: (sheetIdx: number, settings: SheetWebhookSettings) => void;
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "sk_live_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
  onUpdateSheetApiSettings,
  onUpdateSheetWebhookSettings,
}: TriggersConsoleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "triggers" | "analytics" | "api" | "webhook">(
    "logs",
  );

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // New Trigger Form State
  const [triggerName, setTriggerName] = useState("");
  const [eventType, setEventType] = useState<"row_added" | "cell_changed">(
    "cell_changed",
  );
  const [sheetName, setSheetName] = useState("All");
  const [targetColumn, setTargetColumn] = useState<number>(-1); // -1 is Any Column
  const [actionType, setActionType] = useState<"auto_fill" | "log_only">(
    "log_only",
  );
  const [actionColumn, setActionColumn] = useState<number>(0);
  const [actionValue, setActionValue] = useState("");

  const currentSheet = sheets[activeSheetIdx];
  const colCount = currentSheet?.data[0]?.length || 4;

  // API Tab State & Handlers
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<"curl" | "js" | "python">("curl");
  const [origin, setOrigin] = useState("http://localhost:3050");
  const [copiedShareCmd, setCopiedShareCmd] = useState(false);
  const [copiedNgrokCmd, setCopiedNgrokCmd] = useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const handleCopyShareCmd = () => {
    navigator.clipboard.writeText("npm run share");
    setCopiedShareCmd(true);
    setTimeout(() => setCopiedShareCmd(false), 2000);
  };

  const handleCopyNgrokCmd = () => {
    navigator.clipboard.writeText("npx ngrok http 3000");
    setCopiedNgrokCmd(true);
    setTimeout(() => setCopiedNgrokCmd(false), 2000);
  };

  const apiSettings = currentSheet?.apiSettings || {
    enabled: false,
    isPublic: true,
    apiKey: "",
  };

  const handleToggleApi = () => {
    const nextEnabled = !apiSettings.enabled;
    let nextKey = apiSettings.apiKey;
    if (nextEnabled && !nextKey && !apiSettings.isPublic) {
      nextKey = generateApiKey();
    }
    onUpdateSheetApiSettings(activeSheetIdx, {
      ...apiSettings,
      enabled: nextEnabled,
      apiKey: nextKey,
    });
  };

  const handleTogglePublic = (isPublic: boolean) => {
    let nextKey = apiSettings.apiKey;
    if (!isPublic && !nextKey) {
      nextKey = generateApiKey();
    }
    onUpdateSheetApiSettings(activeSheetIdx, {
      ...apiSettings,
      isPublic,
      apiKey: nextKey,
    });
  };

  const handleRegenerateKey = () => {
    onUpdateSheetApiSettings(activeSheetIdx, {
      ...apiSettings,
      apiKey: generateApiKey(),
    });
  };

  const copyToClipboard = (text: string, type: "url" | "key" | "curl" | "js" | "python") => {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSnippet(type);
      setTimeout(() => setCopiedSnippet(null), 2000);
    }
  };

  const currentSheetName = currentSheet?.name || "sheet";
  const isLocalOrigin = origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("192.168.") || origin.includes("10.");
  const endpointUrl = `${origin}/api/sheets/${encodeURIComponent(currentSheetName)}`;
  const apiKeyToUse = apiSettings.apiKey || "YOUR_API_KEY";
  const authHeaderValue = `Bearer ${apiKeyToUse}`;

  const curlSnippet = apiSettings.isPublic
    ? `curl -X GET "${endpointUrl}"`
    : `curl -X GET "${endpointUrl}" \\\n  -H "Authorization: ${authHeaderValue}"`;

  const jsSnippet = apiSettings.isPublic
    ? `fetch("${endpointUrl}")
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));`
    : `fetch("${endpointUrl}", {
  headers: {
    "Authorization": "${authHeaderValue}"
  }
})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));`;

  const pythonSnippet = apiSettings.isPublic
    ? `import requests

url = "${endpointUrl}"

response = requests.get(url)
if response.status_code == 200:
    data = response.json()
    print(data)
else:
    print(f"Error: {response.status_code}", response.text)`
    : `import requests

url = "${endpointUrl}"
headers = {
    "Authorization": "${authHeaderValue}"
}

response = requests.get(url, headers=headers)
if response.status_code == 200:
    data = response.json()
    print(data)
else:
    print(f"Error: {response.status_code}", response.json())`;

  const getJsonPreview = () => {
    if (!currentSheet || !currentSheet.data || currentSheet.data.length === 0) {
      return "[]";
    }

    if (!apiSettings.enabled) {
      return JSON.stringify({
        error: `API access is disabled for sheet "${currentSheet.name}".`,
        message: "Go to API settings tab and enable it to start querying."
      }, null, 2);
    }

    const rows = currentSheet.data;
    const headers: string[] = [];
    const seenHeaders = new Map<string, number>();

    rows[0].forEach((cell: any, index: number) => {
      let val = cell && cell.value !== undefined ? cell.value.toString().trim() : "";
      if (!val) {
        val = `column_${index + 1}`;
      }

      if (seenHeaders.has(val)) {
        const count = seenHeaders.get(val)! + 1;
        seenHeaders.set(val, count);
        val = `${val}_${count}`;
      } else {
        seenHeaders.set(val, 1);
      }
      headers.push(val);
    });

    const records = rows.slice(1, 4).map((row: any[]) => {
      const record: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        const cell = row[index];
        record[header] = cell && cell.value !== undefined ? cell.value : "";
      });
      return record;
    });

    return JSON.stringify(records, null, 2);
  };

  // Webhooks Tab State & Handlers
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{
    ok: boolean;
    status: number;
    text: string;
  } | null>(null);

  React.useEffect(() => {
    setWebhookUrlInput(currentSheet?.webhookSettings?.url || "");
    setWebhookTestResult(null);
  }, [activeSheetIdx, currentSheet]);

  const webhookSettings = currentSheet?.webhookSettings || {
    enabled: false,
    url: "",
  };

  const handleToggleWebhook = () => {
    const nextEnabled = !webhookSettings.enabled;
    onUpdateSheetWebhookSettings(activeSheetIdx, {
      ...webhookSettings,
      enabled: nextEnabled,
    });
  };

  const handleSaveWebhookSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSheetWebhookSettings(activeSheetIdx, {
      ...webhookSettings,
      url: webhookUrlInput.trim(),
    });
  };

  const handleSendTestWebhook = async () => {
    if (!webhookUrlInput.trim()) return;
    setIsTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const res = await fetch("/api/webhooks/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhookUrl: webhookUrlInput.trim(),
          payload: {
            event: "test_connection",
            sheetName: currentSheet?.name || "test",
            timestamp: new Date().toISOString(),
            data: {
              message: "Test webhook connection from Sheet Manager console drawer.",
            },
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setWebhookTestResult({
          ok: data.status >= 200 && data.status < 300,
          status: data.status || 200,
          text: data.statusText || (data.status >= 200 && data.status < 300 ? "Success" : "Failed"),
        });
      } else {
        setWebhookTestResult({
          ok: false,
          status: res.status,
          text: data.error || "Failed to dispatch",
        });
      }
    } catch (err) {
      setWebhookTestResult({
        ok: false,
        status: 500,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const [simulatedWebhooks, setSimulatedWebhooks] = useState<any[]>([]);
  const [isClearingSimulation, setIsClearingSimulation] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"simulator" | "docs">("simulator");

  // Poll mock webhooks when the webhook tab is open
  React.useEffect(() => {
    if (activeTab !== "webhook") return;

    let active = true;

    const fetchSimulated = async () => {
      try {
        const res = await fetch("/api/webhooks/mock-receiver");
        if (res.ok && active) {
          const data = await res.json();
          setSimulatedWebhooks(data);
        }
      } catch (err) {
        console.error("Failed to fetch simulated webhooks", err);
      }
    };

    fetchSimulated();
    const interval = setInterval(fetchSimulated, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeTab]);

  const handleClearSimulation = async () => {
    setIsClearingSimulation(true);
    try {
      const res = await fetch("/api/webhooks/mock-receiver", { method: "DELETE" });
      if (res.ok) {
        setSimulatedWebhooks([]);
      }
    } catch (err) {
      console.error("Failed to clear simulated webhooks", err);
    } finally {
      setIsClearingSimulation(false);
    }
  };

  const handleUseSimulatorUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const simUrl = `${origin}/api/webhooks/mock-receiver`;
    setWebhookUrlInput(simUrl);
    
    onUpdateSheetWebhookSettings(activeSheetIdx, {
      ...webhookSettings,
      url: simUrl,
    });
  };

  // Sample webhook payloads for documentation
  const cellChangedSample = JSON.stringify({
    event: "cell_changed",
    sheetName: currentSheetName,
    timestamp: new Date().toISOString(),
    data: {
      row: 3,
      col: 1,
      prevVal: "100",
      newVal: "150",
      cellRef: "B4"
    }
  }, null, 2);

  const rowAddedSample = JSON.stringify({
    event: "row_added",
    sheetName: currentSheetName,
    timestamp: new Date().toISOString(),
    data: {
      rowIndex: 4,
      details: "Row 5 was added."
    }
  }, null, 2);

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
    const matchesSearch =
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.sheetName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" || log.eventType === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div
      className={`tg-console ${isOpen ? "tg-console--open" : "tg-console--closed"}`}
    >
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
            {dbProvider === "upstash_redis"
              ? "Upstash Redis"
              : dbProvider === "vercel_postgres"
                ? "Vercel Postgres"
                : "Local JSON File"}
          </span>
        </div>

        <div
          style={{ display: "flex", alignItems: "center", gap: "12px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`tg-tab-btn ${activeTab === "logs" ? "tg-tab-btn--active" : ""}`}
            onClick={() => {
              setIsOpen(true);
              setActiveTab("logs");
            }}
          >
            Change Log ({filteredLogs.length})
          </button>
          <button
            className={`tg-tab-btn ${activeTab === "triggers" ? "tg-tab-btn--active" : ""}`}
            onClick={() => {
              setIsOpen(true);
              setActiveTab("triggers");
            }}
          >
            Triggers Manager ({triggers.length})
          </button>
          <button
            className={`tg-tab-btn ${activeTab === "analytics" ? "tg-tab-btn--active" : ""}`}
            onClick={() => {
              setIsOpen(true);
              setActiveTab("analytics");
            }}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <MousePointerClick size={12} />
            Link Analytics
          </button>
          <button
            className={`tg-tab-btn ${activeTab === "api" ? "tg-tab-btn--active" : ""}`}
            onClick={() => {
              setIsOpen(true);
              setActiveTab("api");
            }}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <Code size={12} />
            JSON API
          </button>
          <button
            className={`tg-tab-btn ${activeTab === "webhook" ? "tg-tab-btn--active" : ""}`}
            onClick={() => {
              setIsOpen(true);
              setActiveTab("webhook");
            }}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <Activity size={12} />
            Webhooks
          </button>

          <div className="tg-header-divider" />

          <button
            className="tg-icon-btn"
            onClick={() => setIsOpen(!isOpen)}
            title={isOpen ? "Collapse console" : "Expand console"}
          >
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
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                    >
                      <option value="all">All Events</option>
                      <option value="cell_changed">Cell Changes</option>
                      <option value="row_added">Row Additions</option>
                      <option value="manual_edit">Manual Edits</option>
                      <option value="system">System Logs</option>
                    </select>
                  </div>
                </div>
                <button
                  className="tg-btn tg-btn--danger"
                  onClick={onClearLogs}
                  disabled={logs.length === 0}
                >
                  <Trash2 size={13} />
                  Clear Logs
                </button>
              </div>

              {/* Logs Table */}
              <div className="tg-table-wrapper scrollbar-dark">
                {filteredLogs.length === 0 ? (
                  <div className="tg-empty-state">
                    <Terminal size={24} style={{ opacity: 0.3 }} />
                    <p>
                      No change logs found. Edit cells or configure triggers to
                      see them in action.
                    </p>
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
                        <tr
                          key={log.id}
                          className={`tg-row tg-row--${log.status}`}
                        >
                          <td className="tg-td-time">{log.timestamp}</td>
                          <td>
                            <span
                              className={`tg-event-badge tg-event-badge--${log.eventType}`}
                            >
                              {log.eventType.replace("_", " ")}
                            </span>
                          </td>
                          <td className="tg-td-sheet">{log.sheetName}</td>
                          <td className="tg-td-details">
                            {log.triggerName && (
                              <strong style={{ color: "#38bdf8" }}>
                                [{log.triggerName}]{" "}
                              </strong>
                            )}
                            {log.details}
                          </td>
                          <td>
                            <span
                              className={`tg-status-indicator tg-status-indicator--${log.status}`}
                            >
                              {log.status === "success" && (
                                <CheckCircle2 size={11} />
                              )}
                              {log.status === "warning" && (
                                <AlertTriangle size={11} />
                              )}
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
          ) : activeTab === "analytics" ? (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <ClickAnalyticsPanel />
            </div>
          ) : activeTab === "api" ? (
            <div className="tg-tab-content" style={{ padding: 0 }}>
              <div className="flex h-full w-full gap-4 text-xs p-3 min-h-0 select-text">
                {/* Left Column: API Access Settings & Integration Snippets */}
                <div className="flex-[3] flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-dark min-h-0">
                  
                  {/* Row 1: Enable & Security Mode */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/20 p-3 rounded-lg border border-slate-700/30">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-slate-300 font-semibold text-sm">REST API Integration</span>
                      {isLocalOrigin ? (
                        <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Local Host
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Public Tunnel Active
                        </span>
                      )}
                      <button
                        onClick={handleToggleApi}
                        className={`px-3 py-1.5 rounded font-semibold text-[11px] transition-colors flex items-center gap-1.5 ${
                          apiSettings.enabled
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                            : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                        }`}
                      >
                        {apiSettings.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {apiSettings.enabled ? "API Enabled" : "API Disabled"}
                      </button>
                    </div>

                    {apiSettings.enabled && (
                      <div className="flex gap-2 items-center">
                        <span className="text-slate-400 font-medium">Access Level:</span>
                        <div className="bg-slate-800 p-0.5 rounded-lg inline-flex border border-slate-700">
                          <button
                            type="button"
                            onClick={() => handleTogglePublic(true)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                              apiSettings.isPublic
                                ? "bg-slate-700 text-white shadow-sm"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <span className="flex items-center gap-1"><Globe size={12} /> Public</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePublic(false)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                              !apiSettings.isPublic
                                ? "bg-slate-700 text-white shadow-sm"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <span className="flex items-center gap-1"><Lock size={12} /> Private</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {apiSettings.enabled && (
                    <>
                      {/* Row 2: API Secret Key (only if private) */}
                      {!apiSettings.isPublic && (
                        <div className="flex flex-col gap-1.5 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                              <Key size={13} className="text-amber-400" /> API Secret Key
                            </span>
                            <button
                              onClick={handleRegenerateKey}
                              className="text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1 hover:underline cursor-pointer"
                              title="Generate a new random secret API key"
                            >
                              <RefreshCw size={10} /> Regenerate Key
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type={showApiKey ? "text" : "password"}
                                readOnly
                                value={apiSettings.apiKey || ""}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 pr-8 text-xs font-mono text-slate-300 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                              >
                                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                            <button
                              onClick={() => copyToClipboard(apiSettings.apiKey || "", "key")}
                              className="bg-slate-700 hover:bg-slate-600 text-white px-3 rounded text-xs flex items-center gap-1 shrink-0 font-medium cursor-pointer"
                            >
                              {copiedKey ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
                              {copiedKey ? "Copied" : "Copy Key"}
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Pass this key in the request header as <code>Authorization: Bearer sk_live_...</code>
                          </span>
                        </div>
                      )}

                      {/* Row 3: Live Endpoint URL */}
                      <div className="flex flex-col gap-1.5 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                        <span className="text-slate-400 font-semibold">API Endpoint URL</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={endpointUrl}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-300 outline-none"
                          />
                          <button
                            onClick={() => copyToClipboard(endpointUrl, "url")}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-3 rounded text-xs flex items-center gap-1 shrink-0 font-medium cursor-pointer"
                          >
                            {copiedUrl ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            {copiedUrl ? "Copied" : "Copy URL"}
                          </button>
                        </div>
                      </div>

                      {/* Row 4: Code Snippets */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 border-b border-slate-700 pb-1.5">
                          <Code size={13} className="text-sky-400" />
                          <span className="text-slate-400 font-semibold">Integration Snippets</span>
                          <div className="ml-auto flex gap-1 bg-slate-800 p-0.5 rounded text-[10px]">
                            <button
                              onClick={() => setActiveSnippetTab("curl")}
                              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                activeSnippetTab === "curl" ? "bg-slate-700 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              cURL
                            </button>
                            <button
                              onClick={() => setActiveSnippetTab("js")}
                              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                activeSnippetTab === "js" ? "bg-slate-700 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              JS Fetch
                            </button>
                            <button
                              onClick={() => setActiveSnippetTab("python")}
                              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                activeSnippetTab === "python" ? "bg-slate-700 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              Python
                            </button>
                          </div>
                        </div>
                        <div className="relative bg-slate-950/80 rounded border border-slate-800 p-2.5 font-mono text-[10px] text-slate-300 overflow-x-auto min-h-[75px] max-h-[110px] whitespace-pre scrollbar-dark">
                          <code>
                            {activeSnippetTab === "curl" && curlSnippet}
                            {activeSnippetTab === "js" && jsSnippet}
                            {activeSnippetTab === "python" && pythonSnippet}
                          </code>
                          <button
                            onClick={() => {
                              const snippet = activeSnippetTab === "curl" ? curlSnippet : activeSnippetTab === "js" ? jsSnippet : pythonSnippet;
                              copyToClipboard(snippet, activeSnippetTab);
                            }}
                            className="absolute right-2 top-2 bg-slate-850 hover:bg-slate-700 text-slate-300 p-1 rounded transition-colors cursor-pointer"
                            title="Copy snippet"
                          >
                            {copiedSnippet === activeSnippetTab ? (
                              <CheckCircle2 size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expose Local API Publicly */}
                      {isLocalOrigin && (
                        <div className="flex flex-col gap-2 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 mt-1">
                          <div className="flex items-center gap-1.5">
                            <Globe size={13} className="text-amber-400" />
                            <span className="text-slate-300 font-semibold">Expose Local API Publicly</span>
                            <span className="ml-auto text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Setup Guide</span>
                          </div>
                          <p className="text-slate-400 text-[10px] leading-relaxed">
                            Currently, your API is only accessible on this machine. To share it with clients or external services (e.g. for external testing or live webhooks), run a public tunnel.
                          </p>
                          <div className="flex flex-col gap-1.5 bg-slate-950/60 p-2.5 rounded border border-slate-850 mt-1">
                            <span className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">Option 1: Quick Tunnel (No Signup Required)</span>
                            <div className="flex items-center justify-between gap-2 font-mono text-[9px] bg-slate-900 px-2 py-1.5 rounded text-slate-300 border border-slate-800">
                              <span>npm run share</span>
                              <button
                                onClick={handleCopyShareCmd}
                                className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer flex items-center gap-1"
                              >
                                {copiedShareCmd ? <CheckCircle2 size={10} className="text-emerald-400" /> : null}
                                {copiedShareCmd ? "Copied" : "Copy Command"}
                              </button>
                            </div>
                            <span className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mt-1">Option 2: Using ngrok</span>
                            <div className="flex items-center justify-between gap-2 font-mono text-[9px] bg-slate-900 px-2 py-1.5 rounded text-slate-300 border border-slate-800">
                              <span>npx ngrok http 3000</span>
                              <button
                                onClick={handleCopyNgrokCmd}
                                className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer flex items-center gap-1"
                              >
                                {copiedNgrokCmd ? <CheckCircle2 size={10} className="text-emerald-400" /> : null}
                                {copiedNgrokCmd ? "Copied" : "Copy Command"}
                              </button>
                            </div>
                          </div>
                          <div className="text-[9px] text-slate-500 italic mt-0.5 leading-snug">
                            💡 <strong>Tip:</strong> Once the tunnel is running, open the app via the tunnel's public URL. The dashboard will automatically update all copyable endpoint URLs to target the public host!
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!apiSettings.enabled && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-800/10 rounded-lg border border-dashed border-slate-700/50">
                      <Code size={32} className="text-slate-600 mb-2" />
                      <h4 className="text-slate-300 font-semibold mb-1">API Access is Disabled</h4>
                      <p className="text-slate-500 max-w-sm">
                        Enable the REST API for this worksheet to expose its rows as a standard JSON endpoint for external use.
                      </p>
                    </div>
                  )}

                </div>

                {/* Right Column: Live API Response Preview */}
                <div className="flex-[2] border-l border-slate-800 pl-4 flex flex-col min-h-0">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 shrink-0 mb-2">
                    <span className="text-slate-400 font-semibold">Response Preview (JSON)</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        apiSettings.enabled
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {apiSettings.enabled ? "200 OK" : "403 Forbidden"}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 bg-slate-950/80 rounded border border-slate-800 p-2.5 font-mono text-[10px] overflow-y-auto scrollbar-dark text-left">
                    <pre className="text-emerald-400/90 whitespace-pre-wrap">{getJsonPreview()}</pre>
                  </div>
                </div>

              </div>
            </div>
          ) : activeTab === "webhook" ? (
            <div className="tg-tab-content" style={{ padding: 0 }}>
              <div className="flex h-full w-full gap-4 text-xs p-3 min-h-0 select-text">
                {/* Left Column: Webhook Settings */}
                <div className="flex-[3] flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-dark min-h-0">
                  
                  {/* Status Toggle & Form */}
                  <form onSubmit={handleSaveWebhookSettings} className="flex flex-col gap-4 bg-slate-800/20 p-3 rounded-lg border border-slate-700/30">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-semibold text-sm">Outgoing Webhook Settings</span>
                      <button
                        type="button"
                        onClick={handleToggleWebhook}
                        className={`px-3 py-1.5 rounded font-semibold text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer ${
                          webhookSettings.enabled
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                            : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                        }`}
                      >
                        {webhookSettings.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {webhookSettings.enabled ? "Webhooks Enabled" : "Webhooks Disabled"}
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-400 font-medium">Target Webhook URL</label>
                        <button
                          type="button"
                          onClick={handleUseSimulatorUrl}
                          className="text-sky-400 hover:text-sky-300 font-semibold text-[10px] flex items-center gap-1 cursor-pointer bg-sky-950/40 border border-sky-850 px-2 py-0.5 rounded transition-colors"
                        >
                          <Activity size={10} /> Use Built-in Simulator
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="e.g. https://your-server.com/webhook"
                          value={webhookUrlInput}
                          onChange={(e) => setWebhookUrlInput(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-300 outline-none font-mono"
                          required={webhookSettings.enabled}
                        />
                        <button
                          type="submit"
                          className="bg-sky-600 hover:bg-sky-500 text-white px-4 rounded text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Save Settings
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Changes (cell edits and row additions) will be posted to this URL.
                      </span>
                    </div>
                  </form>

                  {/* Outgoing Test Tool */}
                  {webhookSettings.url && (
                    <div className="flex flex-col gap-3 bg-slate-800/20 p-3 rounded-lg border border-slate-700/30">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-semibold">Test Connection</span>
                        <button
                          type="button"
                          onClick={handleSendTestWebhook}
                          disabled={isTestingWebhook || !webhookUrlInput}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {isTestingWebhook ? (
                            <RefreshCw size={12} className="spin" />
                          ) : (
                            <Send size={12} />
                          )}
                          Send Test Webhook
                        </button>
                      </div>
                      
                      {webhookTestResult && (
                        <div
                          className={`p-2.5 rounded border text-[11px] font-medium flex items-start gap-2 ${
                            webhookTestResult.ok
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {webhookTestResult.ok ? (
                            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          )}
                          <div>
                            <strong>Status: {webhookTestResult.status} {webhookTestResult.text}</strong>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {webhookTestResult.ok
                                ? "Webhook delivered successfully! Your endpoint responded with a success status."
                                : "Delivery failed. Please check the URL, CORS rules, or server logs."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Schema Info */}
                  <div className="flex flex-col gap-2">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <Info size={13} className="text-sky-400" /> Webhook Integration Guidelines
                    </span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Your target server must accept HTTP <code>POST</code> requests with a <code>Content-Type: application/json</code> header.
                      The server should respond with an HTTP status code in the 2xx range to confirm successful receipt of the payload.
                    </p>
                  </div>

                </div>

                {/* Right Column: Webhook Simulator Feed & Payloads Documentation */}
                <div className="flex-[2] border-l border-slate-800 pl-4 flex flex-col min-h-0">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 shrink-0 mb-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRightPanelTab("simulator")}
                        className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          rightPanelTab === "simulator" ? "bg-slate-800 text-sky-400 border border-slate-700" : "text-slate-500 hover:text-slate-350"
                        }`}
                      >
                        Simulated Deliveries ({simulatedWebhooks.length})
                      </button>
                      <button
                        onClick={() => setRightPanelTab("docs")}
                        className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          rightPanelTab === "docs" ? "bg-slate-800 text-sky-400 border border-slate-700" : "text-slate-500 hover:text-slate-350"
                        }`}
                      >
                        Payload Docs
                      </button>
                    </div>
                    {rightPanelTab === "simulator" && simulatedWebhooks.length > 0 && (
                      <button
                        onClick={handleClearSimulation}
                        disabled={isClearingSimulation}
                        className="text-[10px] text-rose-400 hover:text-rose-350 bg-rose-950/20 border border-rose-900/40 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        Clear Feed
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-dark flex flex-col gap-4">
                    
                    {rightPanelTab === "simulator" ? (
                      <div className="flex flex-col gap-3">
                        {simulatedWebhooks.length === 0 ? (
                          <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-850/20 rounded border border-slate-800 text-slate-500">
                            <Activity size={24} className="text-slate-650 mb-1.5 animate-pulse" />
                            <span className="font-semibold text-slate-400 text-xs">No Simulated Events Captured</span>
                            <p className="text-[10px] text-slate-500 max-w-xs mt-1">
                              Use the Built-in Simulator URL, enable webhooks, and trigger a change (like editing a cell) to watch live events capture here!
                            </p>
                          </div>
                        ) : (
                          simulatedWebhooks.map((item) => (
                            <div key={item.id} className="bg-slate-900/60 border border-slate-800 p-2.5 rounded flex flex-col gap-2">
                              <div className="flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold ${
                                    item.payload?.event === "test_connection"
                                      ? "bg-slate-700/50 text-slate-300 border border-slate-600/30"
                                      : item.payload?.event === "row_added"
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                  }`}>
                                    {item.payload?.event || "event"}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-400">{item.payload?.sheetName || "Sheet"}</span>
                                </div>
                                <span className="text-[9px] text-slate-500 font-mono font-medium">{item.receivedAt}</span>
                              </div>
                              <pre className="bg-slate-950/60 p-2 rounded text-[9px] font-mono text-emerald-450 border border-slate-950 overflow-x-auto text-left select-all whitespace-pre">
                                {JSON.stringify(item.payload?.data, null, 2)}
                              </pre>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-slate-300 font-semibold">Event: cell_changed</span>
                          <pre className="bg-slate-950/80 rounded border border-slate-800 p-2 font-mono text-[9px] text-emerald-400/90 overflow-x-auto whitespace-pre text-left">
                            {cellChangedSample}
                          </pre>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <span className="text-slate-300 font-semibold">Event: row_added</span>
                          <pre className="bg-slate-950/80 rounded border border-slate-800 p-2 font-mono text-[9px] text-emerald-400/90 overflow-x-auto whitespace-pre text-left">
                            {rowAddedSample}
                          </pre>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

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
                      <p>
                        No triggers configured yet. Create one on the right.
                      </p>
                    </div>
                  ) : (
                    triggers.map((trigger) => (
                      <div
                        key={trigger.id}
                        className={`tg-item ${!trigger.isActive ? "tg-item--inactive" : ""}`}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <strong
                              style={{ color: "#f8fafc", fontSize: "13px" }}
                            >
                              {trigger.name}
                            </strong>
                            <span
                              className={`tg-event-badge tg-event-badge--${trigger.type}`}
                            >
                              {trigger.type.replace("_", " ")}
                            </span>
                          </div>
                          <p className="tg-item-desc">
                            Scope:{" "}
                            <span style={{ color: "#38bdf8" }}>
                              {trigger.sheetName}
                            </span>
                            {trigger.type === "cell_changed" && (
                              <>
                                {" "}
                                · Target Col:{" "}
                                <span style={{ color: "#f59e0b" }}>
                                  {trigger.targetColumn === -1
                                    ? "Any"
                                    : getColLabel(trigger.targetColumn!)}
                                </span>
                              </>
                            )}
                          </p>
                          <p className="tg-item-action">
                            Action:{" "}
                            {trigger.actionType === "auto_fill" ? (
                              <span>
                                Auto-fill Column{" "}
                                <strong>
                                  {getColLabel(trigger.actionColumn!)}
                                </strong>{" "}
                                with <code>{trigger.actionValueFormula}</code>
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>
                                Log to console only
                              </span>
                            )}
                          </p>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <button
                            className="tg-toggle-btn"
                            onClick={() => onToggleTrigger(trigger.id)}
                            title={
                              trigger.isActive
                                ? "Deactivate trigger"
                                : "Activate trigger"
                            }
                          >
                            {trigger.isActive ? (
                              <ToggleRight
                                size={22}
                                color="var(--clr-success)"
                              />
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
                        onChange={(e) =>
                          setEventType(
                            e.target.value as "row_added" | "cell_changed",
                          )
                        }
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
                          <option key={s.name} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {eventType === "cell_changed" && (
                    <div className="tg-form-group">
                      <label>Trigger on column</label>
                      <select
                        value={targetColumn}
                        onChange={(e) =>
                          setTargetColumn(Number(e.target.value))
                        }
                      >
                        <option value={-1}>Any Column</option>
                        {Array.from({ length: colCount }).map((_, idx) => (
                          <option key={idx} value={idx}>
                            Column {getColLabel(idx)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="tg-form-group">
                    <label>Action</label>
                    <select
                      value={actionType}
                      onChange={(e) =>
                        setActionType(
                          e.target.value as "auto_fill" | "log_only",
                        )
                      }
                    >
                      <option value="log_only">
                        Write description to Change Log only
                      </option>
                      <option value="auto_fill">
                        Auto-fill another cell in the same row
                      </option>
                    </select>
                  </div>

                  {actionType === "auto_fill" && (
                    <div className="tg-form-row">
                      <div className="tg-form-group">
                        <label>Target Write Column</label>
                        <select
                          value={actionColumn}
                          onChange={(e) =>
                            setActionColumn(Number(e.target.value))
                          }
                        >
                          {Array.from({ length: colCount }).map((_, idx) => (
                            <option key={idx} value={idx}>
                              Column {getColLabel(idx)}
                            </option>
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
                {isTestingConnection ? (
                  <RefreshCw size={12} className="spin" />
                ) : (
                  <Database size={12} />
                )}
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
