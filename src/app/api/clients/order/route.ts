import { NextResponse } from "next/server";
import { reorderClients } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    await reorderClients(body.ids ?? []);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Poradi se nepodarilo ulozit." },
      { status: 400 },
    );
  }
}
