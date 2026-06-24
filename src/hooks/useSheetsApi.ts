/* -----------------------------------------------------------------------
 * useSheetsApi.ts — ALL Google Sheets & Drive API calls live here.
 * Uses Google Identity Services (GIS) for client-side OAuth2.
 * ----------------------------------------------------------------------- */

import { useCallback, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SheetTab {
  sheetId: number;
  title: string;
  hidden: boolean;
  index: number;
}

export interface CreatedSheet {
  spreadsheetId: string;
  spreadsheetUrl: string;
  tabs: SheetTab[];
}

export interface SheetsApiState {
  isSignedIn: boolean;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_BASE = "https://www.googleapis.com/drive/v3/files";

// ─── Sample data helpers ──────────────────────────────────────────────────────

const SAMPLE_HEADERS = ["Product", "Q1 Sales", "Q2 Sales", "Q3 Sales"];
const SAMPLE_ROWS = [
  ["Widget A", "1200", "1500", "1800"],
  ["Widget B", "800", "950", "1100"],
  ["Widget C", "2200", "2400", "2700"],
  ["Widget D", "450", "600", "750"],
];

function buildSheetData(userRows: string[][]): string[][] {
  const data = userRows.length > 0 ? userRows : SAMPLE_ROWS;
  return [SAMPLE_HEADERS, ...data];
}

// ─── GIS script loader ────────────────────────────────────────────────────────

let gisLoaded = false;

function loadGisScript(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load GIS script"));
    document.head.appendChild(script);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSheetsApi() {
  const [state, setState] = useState<SheetsApiState>({
    isSignedIn: false,
    accessToken: null,
    isLoading: false,
    error: null,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenClientRef = useRef<any>(null);
  const tokenRef = useRef<string | null>(null);

  const setLoading = (isLoading: boolean) =>
    setState((s) => ({ ...s, isLoading, error: null }));
  const setError = (error: string) =>
    setState((s) => ({ ...s, isLoading: false, error }));

  // ── Auth ──────────────────────────────────────────────────────────────────

  /** Initialize GIS and return an access token via popup. */
  const signIn = useCallback((): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        await loadGisScript();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        if (!google) throw new Error("Google GIS not available");

        if (!CLIENT_ID) {
          throw new Error(
            "NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Add it to .env.local"
          );
        }

        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response: { access_token?: string; error?: string }) => {
            if (response.error) {
              setError(`Auth error: ${response.error}`);
              reject(new Error(response.error));
              return;
            }
            const token = response.access_token!;
            tokenRef.current = token;
            setState((s) => ({
              ...s,
              isSignedIn: true,
              accessToken: token,
              error: null,
            }));
            resolve(token);
          },
        });

        tokenClientRef.current.requestAccessToken({ prompt: "consent" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        reject(err);
      }
    });
  }, []);

  /** Ensure we have a valid token, requesting one if needed. */
  const getToken = useCallback(async (): Promise<string> => {
    if (tokenRef.current) return tokenRef.current;
    return signIn();
  }, [signIn]);

  // ── Sheets API ────────────────────────────────────────────────────────────

  /**
   * Creates a Google Sheet with the given name and 3 tabs.
   * Populates Tab 1 with provided/sample data; Tabs 2 & 3 get placeholder data.
   */
  const createSheet = useCallback(
    async (name: string, userRows: string[][]): Promise<CreatedSheet> => {
      setLoading(true);
      try {
        const token = await getToken();

        const tab1Data = buildSheetData(userRows);
        const tab2Data = [
          ["Month", "Revenue", "Expenses"],
          ["January", "5000", "3200"],
          ["February", "6200", "3800"],
          ["March", "7100", "4100"],
        ];
        const tab3Data = [
          ["Region", "Target", "Actual"],
          ["North", "10000", "9500"],
          ["South", "8000", "8800"],
          ["East", "12000", "11200"],
        ];

        // Step 1: Create spreadsheet with 3 sheets
        const createRes = await fetch(SHEETS_BASE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: { title: name },
            sheets: [
              { properties: { title: "Sheet 1", index: 0 } },
              { properties: { title: "Sheet 2", index: 1 } },
              { properties: { title: "Sheet 3", index: 2 } },
            ],
          }),
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err?.error?.message ?? "Failed to create sheet");
        }

        const created = await createRes.json();
        const spreadsheetId: string = created.spreadsheetId;
        const tabs: SheetTab[] = created.sheets.map(
          (s: { properties: { sheetId: number; title: string; index: number; hidden?: boolean } }) => ({
            sheetId: s.properties.sheetId,
            title: s.properties.title,
            hidden: s.properties.hidden ?? false,
            index: s.properties.index,
          })
        );

        // Step 2: Batch populate all 3 sheets with data
        const dataRes = await fetch(
          `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              valueInputOption: "USER_ENTERED",
              data: [
                { range: "Sheet 1!A1", values: tab1Data },
                { range: "Sheet 2!A1", values: tab2Data },
                { range: "Sheet 3!A1", values: tab3Data },
              ],
            }),
          }
        );

        if (!dataRes.ok) {
          const err = await dataRes.json();
          throw new Error(err?.error?.message ?? "Failed to populate sheet data");
        }

        setState((s) => ({ ...s, isLoading: false }));
        return {
          spreadsheetId,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          tabs,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    [getToken]
  );

  /**
   * Hides the given sheet tabs via batchUpdate.
   * sheetIds — array of numeric sheet IDs to hide.
   */
  const hideTabs = useCallback(
    async (spreadsheetId: string, sheetIds: number[]): Promise<void> => {
      setLoading(true);
      try {
        const token = await getToken();

        const requests = sheetIds.map((sheetId) => ({
          updateSheetProperties: {
            properties: { sheetId, hidden: true },
            fields: "hidden",
          },
        }));

        const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requests }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err?.error?.message ?? "Failed to hide tabs");
        }

        setState((s) => ({ ...s, isLoading: false }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    [getToken]
  );

  /**
   * Shares the file with "anyone with the link" as a Viewer.
   * Returns the shareable link.
   */
  const shareSheet = useCallback(
    async (fileId: string): Promise<string> => {
      setLoading(true);
      try {
        const token = await getToken();

        const res = await fetch(`${DRIVE_BASE}/${fileId}/permissions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: "reader",
            type: "anyone",
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err?.error?.message ?? "Failed to share sheet");
        }

        setState((s) => ({ ...s, isLoading: false }));
        return `https://docs.google.com/spreadsheets/d/${fileId}/edit?usp=sharing`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    [getToken]
  );

  /**
   * Creates a Google Sheet with a list of custom worksheets and populates each worksheet with data.
   */
  const createSheetFromImport = useCallback(
    async (
      name: string,
      importedSheets: {
        name: string;
        data: string[][];
        cols?: { hidden?: boolean }[];
        rows?: { hidden?: boolean }[];
      }[]
    ): Promise<CreatedSheet> => {
      setLoading(true);
      try {
        const token = await getToken();

        // 1. Create spreadsheet with custom sheet names
        const createRes = await fetch(SHEETS_BASE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: { title: name },
            sheets: importedSheets.map((s, idx) => ({
              properties: { title: s.name, index: idx },
            })),
          }),
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err?.error?.message ?? "Failed to create sheet");
        }

        const created = await createRes.json();
        const spreadsheetId: string = created.spreadsheetId;
        const tabs: SheetTab[] = created.sheets.map(
          (s: { properties: { sheetId: number; title: string; index: number; hidden?: boolean } }) => ({
            sheetId: s.properties.sheetId,
            title: s.properties.title,
            hidden: s.properties.hidden ?? false,
            index: s.properties.index,
          })
        );

        // 2. Batch update values for each sheet
        const data = importedSheets.map((s) => ({
          range: `'${s.name.replace(/'/g, "''")}'!A1`,
          values: s.data,
        }));

        const dataRes = await fetch(
          `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              valueInputOption: "USER_ENTERED",
              data,
            }),
          }
        );

        if (!dataRes.ok) {
          const err = await dataRes.json();
          throw new Error(err?.error?.message ?? "Failed to populate sheet data");
        }

        // 3. Batch update dimension properties to hide rows/columns
        const visibilityRequests: any[] = [];
        importedSheets.forEach((s, idx) => {
          const sheetId = tabs[idx].sheetId;

          // Columns
          s.cols?.forEach((col, colIdx) => {
            if (col?.hidden) {
              visibilityRequests.push({
                updateDimensionProperties: {
                  range: {
                    sheetId,
                    dimension: "COLUMNS",
                    startIndex: colIdx,
                    endIndex: colIdx + 1,
                  },
                  properties: {
                    hiddenByUser: true,
                  },
                  fields: "hiddenByUser",
                },
              });
            }
          });

          // Rows
          s.rows?.forEach((row, rowIdx) => {
            if (row?.hidden) {
              visibilityRequests.push({
                updateDimensionProperties: {
                  range: {
                    sheetId,
                    dimension: "ROWS",
                    startIndex: rowIdx,
                    endIndex: rowIdx + 1,
                  },
                  properties: {
                    hiddenByUser: true,
                  },
                  fields: "hiddenByUser",
                },
              });
            }
          });
        });

        if (visibilityRequests.length > 0) {
          const visRes = await fetch(
            `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ requests: visibilityRequests }),
            }
          );

          if (!visRes.ok) {
            const err = await visRes.json();
            console.warn("Failed to apply row/column visibility to Google Sheets:", err);
          }
        }

        setState((s) => ({ ...s, isLoading: false }));
        return {
          spreadsheetId,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          tabs,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    [getToken]
  );

  return {
    ...state,
    signIn,
    createSheet,
    createSheetFromImport,
    hideTabs,
    shareSheet,
  };
}
