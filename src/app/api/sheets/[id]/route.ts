import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";

const SCRATCH_DIR = path.join(process.cwd(), "scratch");
const DB_FILE = path.join(SCRATCH_DIR, "sheet_db.json");

// Helper to slugify worksheet name for clean URLs
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")           // Replace spaces with -
    .replace(/[^\w\-]+/g, "")       // Remove all non-word chars
    .replace(/\-\-+/g, "-")         // Replace multiple - with single -
    .replace(/^-+/, "")             // Trim - from start
    .replace(/-+$/, "");            // Trim - from end
}

// Database loading helper (mirrors route.ts Upstash/Local fallback)
async function loadDbState() {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/sheet_db_state`, {
        headers: {
          Authorization: `Bearer ${kvToken}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.result) {
          return JSON.parse(json.result);
        }
      }
    } catch (err) {
      console.error("Failed to load from Upstash Redis:", err);
    }
  }

  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    // File doesn't exist yet, return null
  }
  return null;
}

// CORS Headers for public endpoints
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apiKey, _apiKey",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sheetIdParam } = await params;
    const decodedId = decodeURIComponent(sheetIdParam).trim();
    const searchParams = req.nextUrl.searchParams;

    let rows: any[] = [];

    // Check if the requested ID is a Google Spreadsheet ID
    const isGoogleSheetId = /^[a-zA-Z0-9-_]{40,50}$/.test(decodedId);

    if (isGoogleSheetId) {
      // Fetch live data from Google Sheets publicly
      try {
        const targetSheet = searchParams.get("_sheet") || searchParams.get("sheet") || "";
        const targetGid = searchParams.get("_gid") || searchParams.get("gid") || "";

        let csvUrl = `https://docs.google.com/spreadsheets/d/${decodedId}/export?format=csv`;
        if (targetGid) {
          csvUrl = `https://docs.google.com/spreadsheets/d/${decodedId}/export?format=csv&gid=${targetGid}`;
        } else if (targetSheet) {
          csvUrl = `https://docs.google.com/spreadsheets/d/${decodedId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(targetSheet)}`;
        }

        const response = await fetch(csvUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        if (!response.ok) {
          return NextResponse.json(
            {
              error: `Failed to fetch Google Sheet. Verify that the spreadsheet ID is correct and sharing settings are set to "Anyone with the link can view".`,
              details: `Google Sheets returned status ${response.status}`,
            },
            { status: response.status || 400, headers: corsHeaders }
          );
        }

        const csvText = await response.text();
        const workbook = XLSX.read(csvText, { type: "string" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
          return NextResponse.json(
            { error: "Google Sheet tab is empty or invalid." },
            { status: 400, headers: corsHeaders }
          );
        }

        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (!rawRows || rawRows.length === 0) {
          return NextResponse.json([], { headers: corsHeaders });
        }

        // Convert raw rows to expected CellData[][] structure
        rows = rawRows.map((row: any[]) =>
          row.map((cell: any) => ({
            value: cell !== null && cell !== undefined ? cell : ""
          }))
        );
      } catch (fetchErr) {
        return NextResponse.json(
          {
            error: "Failed to fetch or parse Google Sheet. Please check the ID and verify it is shared publicly.",
            details: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
          },
          { status: 500, headers: corsHeaders }
        );
      }
    } else {
      // 1. Load Local/Redis Database Data
      const dbState = await loadDbState();
      if (!dbState || !dbState.sheets || !Array.isArray(dbState.sheets)) {
        return NextResponse.json(
          { error: "No sheets found in database." },
          { status: 404, headers: corsHeaders }
        );
      }

      // 2. Find Sheet (exact name match or slug match)
      const sheet = dbState.sheets.find(
        (s: any) =>
          s.name.toLowerCase() === decodedId.toLowerCase() ||
          slugify(s.name) === decodedId.toLowerCase()
      );

      if (!sheet) {
        return NextResponse.json(
          { error: `Sheet "${decodedId}" not found.` },
          { status: 404, headers: corsHeaders }
        );
      }

      // 3. Authenticate & Verify Permissions
      const apiSettings = sheet.apiSettings || { enabled: false, isPublic: true };

      if (!apiSettings.enabled) {
        return NextResponse.json(
          { error: `API access is disabled for sheet "${sheet.name}". Enable it in the Sheet Manager console.` },
          { status: 403, headers: corsHeaders }
        );
      }

      if (!apiSettings.isPublic) {
        const authHeader = req.headers.get("Authorization");
        let providedApiKey = "";
        if (authHeader && authHeader.startsWith("Bearer ")) {
          providedApiKey = authHeader.substring(7);
        } else {
          providedApiKey = searchParams.get("_apiKey") || searchParams.get("apiKey") || "";
        }

        if (!providedApiKey || providedApiKey !== apiSettings.apiKey) {
          return NextResponse.json(
            { error: "Unauthorized. Invalid or missing API key." },
            { status: 401, headers: corsHeaders }
          );
        }
      }

      // 4. Set rows from local sheet data
      rows = sheet.data;
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json([], { headers: corsHeaders });
    }

    // Extract & Deduplicate Headers
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

    // Parse records
    let records = rows.slice(1).map((row: any[]) => {
      const record: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        const cell = row[index];
        record[header] = cell && cell.value !== undefined ? cell.value : "";
      });
      return record;
    });

    // 5. Apply Column Filters (ignore params starting with '_')
    const filterParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (!key.startsWith("_") && key !== "apiKey") {
        filterParams[key] = value;
      }
    });

    if (Object.keys(filterParams).length > 0) {
      records = records.filter((rec: any) => {
        return Object.entries(filterParams).every(([key, val]) => {
          const actualKey = Object.keys(rec).find(
            (k) => k.toLowerCase() === key.toLowerCase()
          );
          if (!actualKey) return false;

          const recordValue = String(rec[actualKey] ?? "").toLowerCase();
          const filterValue = String(val).toLowerCase();
          return recordValue === filterValue;
        });
      });
    }

    // 6. Apply Sorting (_sort, _order)
    const sortKey = searchParams.get("_sort");
    const sortOrder = searchParams.get("_order") || "asc";
    if (sortKey) {
      const actualSortKey = headers.find(
        (h) => h.toLowerCase() === sortKey.toLowerCase()
      );
      if (actualSortKey) {
        records.sort((a: any, b: any) => {
          const valA = a[actualSortKey] ?? "";
          const valB = b[actualSortKey] ?? "";

          // Try numeric comparison (strip symbols like $, commas)
          const numA = Number(valA.toString().replace(/[\$,]/g, ""));
          const numB = Number(valB.toString().replace(/[\$,]/g, ""));

          if (!isNaN(numA) && !isNaN(numB)) {
            return sortOrder.toLowerCase() === "desc" ? numB - numA : numA - numB;
          }

          return sortOrder.toLowerCase() === "desc"
            ? String(valB).localeCompare(String(valA))
            : String(valA).localeCompare(String(valB));
        });
      }
    }

    // 7. Apply Pagination (_limit, _offset)
    const limitStr = searchParams.get("_limit");
    const offsetStr = searchParams.get("_offset");

    let start = 0;
    if (offsetStr) {
      const parsedOffset = parseInt(offsetStr, 10);
      if (!isNaN(parsedOffset) && parsedOffset >= 0) {
        start = parsedOffset;
      }
    }

    let end = records.length;
    if (limitStr) {
      const parsedLimit = parseInt(limitStr, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        end = start + parsedLimit;
      }
    }

    records = records.slice(start, end);

    return NextResponse.json(records, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
