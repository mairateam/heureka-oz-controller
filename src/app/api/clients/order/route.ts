import { NextResponse } from "next/server";
import { reorderClients } from "@/lib/data";
import { muzeUpravovat } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  if (!(await muzeUpravovat())) {
    return NextResponse.json({ error: "Na tuhle akci se musíš přihlásit." }, { status: 401 });
  }

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
