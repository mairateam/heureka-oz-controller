import { NextResponse } from "next/server";
import { addClient } from "@/lib/data";
import { muzeUpravovat } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await muzeUpravovat())) {
    return NextResponse.json({ error: "Na tuhle akci se musíš přihlásit." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { url?: string };
    const client = await addClient(body.url ?? "");
    return NextResponse.json({ client });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Klienta se nepodarilo pridat." },
      { status: 400 },
    );
  }
}
