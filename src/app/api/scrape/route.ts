import { NextResponse } from "next/server";
import { runScrape } from "@/lib/data";
import { muzeUpravovat } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (!(await muzeUpravovat())) {
    return NextResponse.json({ error: "Na tuhle akci se musíš přihlásit." }, { status: 401 });
  }

  try {
    return NextResponse.json(await runScrape());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scrape selhal." },
      { status: 500 },
    );
  }
}
