import { fetchHtml } from "./fetchHtml";
import type { Certificate, Market, ScrapeResult } from "./types";

export class HeurekaError extends Error {}

/**
 * Z libovolne podoby odkazu na obchod udela kanonicky profil,
 * napr. https://obchody.heureka.cz/notino-cz/recenze/ -> https://obchody.heureka.cz/notino-cz/
 * Root profil funguje na obou trzich a Heureka si sama presmeruje na spravnou zalozku.
 */
export function normalizeShopUrl(input: string): { url: string; slug: string; market: Market } {
  const raw = input.trim();
  if (!raw) throw new HeurekaError("Zadej URL obchodu na Heurece.");

  let parsed: URL;
  try {
    parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    throw new HeurekaError("To nevypada jako platna URL.");
  }

  const host = parsed.hostname.toLowerCase();
  const market: Market | null = host.endsWith("heureka.cz")
    ? "cz"
    : host.endsWith("heureka.sk")
      ? "sk"
      : null;
  if (!market) {
    throw new HeurekaError("Podporujeme jen odkazy na heureka.cz a heureka.sk.");
  }

  const slug = parsed.pathname.split("/").filter(Boolean)[0];
  if (!slug) {
    throw new HeurekaError("V URL chybi nazev obchodu, napr. obchody.heureka.cz/nazev-obchodu/");
  }

  return { url: `https://obchody.heureka.${market}/${slug}/`, slug, market };
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseCertificate(html: string): Certificate {
  const match = html.match(/recommendation__certificate"[^>]*src="([^"]+)"/);
  const src = match?.[1] ?? "";
  if (/gold/i.test(src)) return "gold";
  if (/blue/i.test(src)) return "blue";
  return "none";
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[\s\u00a0]/g, "").replace(",", ".");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function parseShopHtml(html: string, market: Market, slug: string, url: string): ScrapeResult {
  const percentage = parseNumber(
    html.match(/recommendation__percentage">\s*([0-9]+)/)?.[1],
  );

  if (percentage === null) {
    throw new HeurekaError(
      "Na strance jsem nenasel procento spokojenosti — zkontroluj, ze URL vede na profil obchodu.",
    );
  }

  const name = decodeEntities(
    html.match(/data-shop-name="([^"]+)"/)?.[1] ?? slug,
  );

  const logoUrl =
    html.match(/shop-detail-header__logo[\s\S]{0,600}?<img[^>]*src="([^"]+)"/)?.[1] ?? "";

  // Prvni radek tabulky statistik je celkova spokojenost (0-5).
  const rating = parseNumber(
    html.match(/shop-detail-stats__value">\s*([0-9]+[.,]?[0-9]*)/)?.[1],
  );

  // Pocet recenzi je v zalozce nad vypisem recenzi.
  const reviewCount = parseNumber(
    html.match(/Recenz[ei][^0-9<]{0,60}?<[^>]*>\s*([0-9\s\u00a0]+)\s*</)?.[1],
  );

  return {
    name,
    slug,
    market,
    url,
    logoUrl: decodeEntities(logoUrl),
    percentage,
    certificate: parseCertificate(html),
    rating,
    reviewCount,
  };
}

/** Stavy, u kterych ma smysl to zkusit znovu — Heureka pri rychlem sledu obcas odmitne. */
const RETRYABLE = new Set([403, 408, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1500, 4000];

export async function scrapeShop(inputUrl: string): Promise<ScrapeResult> {
  const { url, slug, market } = normalizeShopUrl(inputUrl);
  const headers = {
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": market === "cz" ? "cs-CZ,cs;q=0.9" : "sk-SK,sk;q=0.9,cs;q=0.8",
  };

  let lastStatus = 0;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
    }

    const { status, body } = await fetchHtml(url, headers);

    if (status === 200) return parseShopHtml(body, market, slug, url);
    if (status === 404) {
      throw new HeurekaError("Heureka takovy obchod nezna (404). Zkontroluj nazev v URL.");
    }

    lastStatus = status;
    if (!RETRYABLE.has(status)) break;
  }

  throw new HeurekaError(
    `Heureka vratila HTTP ${lastStatus} ani po opakovanych pokusech. Zkus to pozdeji.`,
  );
}
