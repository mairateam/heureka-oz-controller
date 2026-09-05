import { NextResponse } from "next/server";
import { removeClient } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await removeClient(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Smazani se nepovedlo." },
      { status: 400 },
    );
  }
}
