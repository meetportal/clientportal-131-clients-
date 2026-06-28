import { NextRequest, NextResponse } from "next/server";
import { loadData, saveData } from "../../db/route";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const dbState = await loadData();
    const existingWebhooks = (dbState && (dbState as any).mockWebhooks) || [];

    const newWebhookLog = {
      id: `mwh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      receivedAt: new Date().toLocaleTimeString(),
      payload,
    };

    // Prepend and cap at 15 items
    const updatedWebhooks = [newWebhookLog, ...existingWebhooks].slice(0, 15);

    await saveData({ mockWebhooks: updatedWebhooks });

    return NextResponse.json({
      success: true,
      message: "Webhook simulated successfully",
      logged: newWebhookLog,
    });
  } catch (err) {
    console.error("[Mock Receiver POST Error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to record mock webhook" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const dbState = await loadData();
    const mockWebhooks = (dbState && (dbState as any).mockWebhooks) || [];
    return NextResponse.json(mockWebhooks);
  } catch (err) {
    console.error("[Mock Receiver GET Error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load mock webhooks" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await saveData({ mockWebhooks: [] });
    return NextResponse.json({ success: true, message: "Mock webhooks cleared" });
  } catch (err) {
    console.error("[Mock Receiver DELETE Error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to clear mock webhooks" },
      { status: 500 }
    );
  }
}
