import { fetchHtml } from "./fetchHtml";
import { HeurekaError } from "./heureka";
import type { Certificate, Market, ScrapeResult } from "./types";

/**
 * Data obchodu pres oficialni widget "Overeno zakazniky".
 *
 * Proc tudy: profil obchodu na obchody.heureka.cz je za Cloudflare, ktery
 * odmita datacentrove IP — z GitHub Actions ani z Google Apps Scriptu
 * neprojde nic. Widget ale musi fungovat navstevnikum e-shopu, takze cesta
 * /direct/i/ za bot ochranou byt nemuze a projde odkudkoli.
 *
 * Klic ("sak") visi verejne na webu kazdeho e-shopu, ktery widget pouziva;
 * jinak ho obchodnik najde v administraci Overeno zakazniky.
 *
 * POZOR: klic patri ke konkretnimu trhu — slovensky obchod je potreba ptat
 * se na heureka.sk, jinak prijde odpoved "widget vypnuty".
 */

/** Widget k tomuhle klici nic nevraci — data je potreba vzit z profilu obchodu. */
export class WidgetNedostupny extends HeurekaError {
  constructor() {
    super("Widget k tomuhle klici nevraci zadna data.");
  }
}

function host(market: Market): string {
  return market === "cz" ? "www.heureka.cz" : "www.heureka.sk";
}

/**
 * Uroven certifikatu: obchod bez nej nema ve widgetu o certifikatu ani zminku,
 * zlaty od modreho odlisi priznak goldTab z widget skriptu.
 */
function parsujCertifikat(widgetHtml: string, gjs: string): Certificate {
  if (!/certifik/i.test(widgetHtml)) return "none";
  return /var\s+goldTab\s*=\s*true/.test(gjs) ? "gold" : "blue";
}

function cislo(value: string | undefined): number | null {
  if (!value) return null;
  const num = Number.parseFloat(value.replace(/[\s ]/g, "").replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

export async function scrapeWidget(
  widgetKey: string,
  market: Market,
  slug: string,
  name: string,
  profileUrl: string,
  logoUrl: string,
): Promise<ScrapeResult> {
  const base = `https://${host(market)}/direct/i`;
  const headers = { "User-Agent-Note": "widget", Accept: "text/html" };

  const [widget, gjs] = await Promise.all([
    fetchHtml(`${base}/widget.php?key=${encodeURIComponent(widgetKey)}&wt=21&destrc=1`, headers),
    fetchHtml(`${base}/gjs.php?n=wdgt&sak=${encodeURIComponent(widgetKey)}`, headers),
  ]);

  if (widget.status !== 200) {
    throw new HeurekaError(`Widget odpovedel HTTP ${widget.status}.`);
  }

  // Nektere klice vraci prazdnou odpoved — pak se data musi vzit z profilu.
  if (widget.body.trim().length === 0) throw new WidgetNedostupny();

  const certificate = parsujCertifikat(widget.body, gjs.body);

  // Procento vazeme na vetu vedle nej, at nechytneme font-size z CSS.
  const percentage = cislo(
    widget.body.match(/([0-9]+)\s*%[\s\S]{0,160}?(?:doporučil|odporúčal)/)?.[1],
  );

  if (percentage === null) {
    throw new HeurekaError("Ve widgetu jsem nenasel procento spokojenosti.");
  }

  return {
    name,
    slug,
    market,
    url: profileUrl,
    logoUrl,
    percentage,
    certificate,
    rating: cislo(widget.body.match(/(?:Hodnocení|Hodnotenie):\s*([0-9.,]+)/)?.[1]),
    reviewCount: cislo(widget.body.match(/>\s*([0-9\s ]+)\s*recenz/)?.[1]),
  };
}
