import { NextResponse } from "next/server";
import { runScrape } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    return NextResponse.json(await runScrape());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scrape selhal." },
      { status: 500 },
    );
  }
}
