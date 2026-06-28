import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Path for local storage fallback
const SCRATCH_DIR = path.join(process.cwd(), "scratch");
const DB_FILE = path.join(SCRATCH_DIR, "sheet_db.json");

// Helper to ensure scratch dir exists
async function ensureScratchDir() {
  try {
    await fs.mkdir(SCRATCH_DIR, { recursive: true });
  } catch (e) {
    // Ignore if exists
  }
}

// In-memory fallback if file system fails or in production without env variables
let inMemoryDb: unknown = null;

export async function loadData() {
  // 1. Try Upstash Redis / Vercel KV if config exists
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

  // 2. Try Local File Storage (in dev)
  try {
    await ensureScratchDir();
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    // File doesn't exist yet, return null
  }

  // 3. Fallback to In-Memory
  return inMemoryDb;
}

export async function saveData(state: unknown) {
  // Load existing data to perform a shallow merge and prevent wiping other fields
  let mergedState = state;
  if (state && typeof state === "object" && !Array.isArray(state)) {
    try {
      const existing = await loadData();
      if (existing && typeof existing === "object" && !Array.isArray(existing)) {
        mergedState = { ...existing, ...state };
      }
    } catch (e) {
      console.warn("Failed to load existing data for merge, proceeding with full overwrite", e);
    }
  }

  // 1. Try Upstash Redis / Vercel KV
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const res = await fetch(kvUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kvToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["SET", "sheet_db_state", JSON.stringify(mergedState)]),
      });
      if (res.ok) {
        return { success: true, provider: "upstash_redis" };
      }
    } catch (err) {
      console.error("Failed to save to Upstash Redis:", err);
    }
  }

  // 2. Try Local File Storage
  try {
    await ensureScratchDir();
    await fs.writeFile(DB_FILE, JSON.stringify(mergedState, null, 2), "utf-8");
    return { success: true, provider: "local_json_file" };
  } catch (err) {
    console.error("Failed to save to local file:", err);
  }

  // 3. Fallback to In-Memory
  inMemoryDb = mergedState;
  return { success: true, provider: "in_memory" };
}


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const testMode = searchParams.get("test");

  if (testMode === "true") {
    // Connection test endpoint
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    const postgresUrl = process.env.POSTGRES_URL;

    let activeProvider = "local_json_file";
    let details = "Using local scratch/sheet_db.json file for development storage.";

    if (kvUrl && kvToken) {
      activeProvider = "upstash_redis";
      details = "Connected to Upstash Redis (Vercel KV replacement).";
    } else if (postgresUrl) {
      activeProvider = "vercel_postgres";
      details = "Postgres URL configured (placeholder for connection).";
    }

    return NextResponse.json({
      status: "connected",
      provider: activeProvider,
      details,
      env: {
        hasKv: !!kvUrl,
        hasPostgres: !!postgresUrl,
      },
    });
  }

  const data = await loadData();
  return NextResponse.json(data || { sheets: [], triggers: [], logs: [], printTemplates: [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await saveData(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save data" },
      { status: 500 }
    );
  }
}
