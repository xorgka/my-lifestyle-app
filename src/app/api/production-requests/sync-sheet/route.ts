import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabaseAnon";
import { loadProductionRequestById, setProductionRequestSheetRow } from "@/lib/productionRequestsDb";
import { syncProductionRequestRow, isGoogleSheetsConfigured } from "@/lib/googleSheets";

export async function POST(req: Request) {
  try {
    if (!isGoogleSheetsConfigured) {
      return NextResponse.json({ ok: false, error: "google_sheets_not_configured" }, { status: 503 });
    }

    const body = (await req.json()) as { id?: string };
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    const supabase = createSupabaseAnonClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
    }

    const request = await loadProductionRequestById(id, supabase);
    if (!request) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const sheetRow = await syncProductionRequestRow(request);
    if (sheetRow !== request.sheetRow) {
      await setProductionRequestSheetRow(id, sheetRow, supabase);
    }

    return NextResponse.json({ ok: true, sheetRow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
