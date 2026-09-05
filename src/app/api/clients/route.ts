import { NextResponse } from "next/server";
import { addClient } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
