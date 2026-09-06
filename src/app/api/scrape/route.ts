import { NextResponse } from "next/server";
import { runScrape } from "@/lib/data";
import { muzeUpravovat } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vercel Cron se hlasi sdilenym tajemstvim, lide prihlasenim. */
async function smiSpustit(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return muzeUpravovat();
}

export async function POST(request: Request) {
  if (!(await smiSpustit(request))) {
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

// Vercel Cron chodi metodou GET.
export async function GET(request: Request) {
  return POST(request);
}
