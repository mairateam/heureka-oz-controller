import { NextResponse } from "next/server";
import { removeClient } from "@/lib/data";
import { muzeUpravovat } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await muzeUpravovat())) {
    return NextResponse.json({ error: "Na tuhle akci se musíš přihlásit." }, { status: 401 });
  }

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
