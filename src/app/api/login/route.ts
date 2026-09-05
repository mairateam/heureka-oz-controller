import { NextResponse } from "next/server";
import { overHeslo, heslJeNastaveno, COOKIE_NAZEV, COOKIE_MAX_AGE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!heslJeNastaveno()) {
    return NextResponse.json(
      { error: "Na serveru není nastavené heslo (ADMIN_PASSWORD), úpravy jsou zamčené." },
      { status: 503 },
    );
  }

  const { password } = (await request.json()) as { password?: string };
  const token = overHeslo(password ?? "");

  if (!token) {
    return NextResponse.json({ error: "Špatné heslo." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAZEV, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAZEV);
  return response;
}
