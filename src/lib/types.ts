export type Market = "cz" | "sk";

/** Uroven certifikatu Overeno zakazniky, jak ji Heureka zobrazuje u obchodu. */
export type Certificate = "gold" | "blue" | "none";

export interface Client {
  id: string;
  name: string;
  market: Market;
  slug: string;
  url: string;
  logoUrl: string;
  addedAt: string;
  active: boolean;
  /** Klic widgetu Overeno zakazniky. Kdyz je vyplneny, scrape jde pres nej. */
  widgetKey: string;
}

export interface Snapshot {
  date: string; // YYYY-MM-DD
  clientId: string;
  clientName: string;
  market: Market;
  percentage: number | null;
  certificate: Certificate;
  rating: number | null;
  reviewCount: number | null;
  scrapedAt: string; // ISO
  error: string;
}

/** Vysledek scrapu jednoho profilu, jeste nez se z nej stane Snapshot. */
export interface ScrapeResult {
  name: string;
  slug: string;
  market: Market;
  url: string;
  logoUrl: string;
  percentage: number | null;
  certificate: Certificate;
  rating: number | null;
  reviewCount: number | null;
}

export interface ClientWithHistory extends Client {
  latest: Snapshot | null;
  previous: Snapshot | null;
  history: Snapshot[];
}

/** Zjednoduseny tvar klienta pro dlazdici na prehledu. */
export interface ClientCardData {
  id: string;
  name: string;
  market: Market;
  logoUrl: string;
  percentage: number | null;
  previousPercentage: number | null;
  certificate: Certificate;
  rating: number | null;
  reviewCount: number | null;
  scrapedAt: string;
  error: string;
}
