import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Dashboard je verejny — data z Heureky nejsou tajna a kolegove se maji
 * podivat bez prihlasovani. Zapisove operace (pridat, odebrat, prerovnat,
 * spustit scrape) ale za heslem byt musi, jinak by je na verejne adrese
 * mohl spustit kdokoli.
 *
 * Heslo je jedno sdilene pro tym, v promenne ADMIN_PASSWORD. Kdyz neni
 * nastavene, zapis se odmita cely — radeji zamcene nez omylem otevrene.
 */
const COOKIE = "heureka_oz_session";
const MAX_AGE_DNI = 30;

function ocekavanyToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHmac("sha256", password).update("heureka-oz-session").digest("hex");
}

export function heslJeNastaveno(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function overHeslo(zadane: string): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !zadane) return null;

  const a = Buffer.from(zadane);
  const b = Buffer.from(password);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return ocekavanyToken();
}

export async function muzeUpravovat(): Promise<boolean> {
  const ocekavany = ocekavanyToken();
  if (!ocekavany) return false;

  const cookie = (await cookies()).get(COOKIE)?.value;
  if (!cookie || cookie.length !== ocekavany.length) return false;

  return timingSafeEqual(Buffer.from(cookie), Buffer.from(ocekavany));
}

export const COOKIE_NAZEV = COOKIE;
export const COOKIE_MAX_AGE = MAX_AGE_DNI * 24 * 60 * 60;
