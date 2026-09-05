import { scrapeShop, normalizeShopUrl, HeurekaError } from "./heureka";
import { scrapeWidget } from "./heurekaWidget";
import { getClients, getSnapshots, saveClients, saveSnapshots } from "./store";
import type { Client, ClientWithHistory, ScrapeResult, Snapshot } from "./types";

export function today(): string {
  // Vsechno pocitame v ceskem case, at se datum neprehodi kvuli UTC.
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date());
}

/**
 * Rucni scrape jde spustit vickrat denne, takze na jeden den drzime
 * jen posledni zaznam a starsi pokusy ignorujeme.
 */
function dedupeByDay(snapshots: Snapshot[]): Snapshot[] {
  const byKey = new Map<string, Snapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.clientId}|${snapshot.date}`;
    const current = byKey.get(key);
    if (!current || snapshot.scrapedAt >= current.scrapedAt) byKey.set(key, snapshot);
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getDashboard(): Promise<ClientWithHistory[]> {
  const [clients, snapshots] = await Promise.all([getClients(), getSnapshots()]);
  const clean = dedupeByDay(snapshots);

  return clients.map((client) => {
    const history = clean.filter((s) => s.clientId === client.id);
    const withValue = history.filter((s) => s.percentage !== null);
    return {
      ...client,
      history,
      latest: withValue.at(-1) ?? null,
      previous: withValue.at(-2) ?? null,
    };
  });
}

export async function addClient(inputUrl: string): Promise<Client> {
  const { url } = normalizeShopUrl(inputUrl);
  const clients = await getClients();

  if (clients.some((c) => c.url === url)) {
    throw new HeurekaError("Tenhle obchod uz v prehledu je.");
  }

  // Prvni scrape slouzi i jako overeni, ze URL opravdu vede na profil obchodu.
  const scraped = await scrapeShop(url);

  const client: Client = {
    id: `${scraped.market}-${scraped.slug}`,
    name: scraped.name,
    market: scraped.market,
    slug: scraped.slug,
    url: scraped.url,
    logoUrl: scraped.logoUrl,
    addedAt: new Date().toISOString(),
    active: true,
    widgetKey: "",
  };

  await saveClients([...clients, client]);
  await saveSnapshots([
    {
      date: today(),
      clientId: client.id,
      clientName: client.name,
      market: client.market,
      percentage: scraped.percentage,
      certificate: scraped.certificate,
      rating: scraped.rating,
      reviewCount: scraped.reviewCount,
      scrapedAt: new Date().toISOString(),
      error: "",
    },
  ]);

  return client;
}

/**
 * Poradi dlazdic na prehledu = poradi radku v ulozisti. Klienty, ktere
 * prichozi seznam nezna (nekdo je pridal mezitim), nechavame na konci.
 */
export async function reorderClients(ids: string[]): Promise<void> {
  const clients = await getClients();
  const byId = new Map(clients.map((c) => [c.id, c]));

  const ordered = ids.map((id) => byId.get(id)).filter((c): c is Client => Boolean(c));
  const seen = new Set(ordered.map((c) => c.id));
  const rest = clients.filter((c) => !seen.has(c.id));

  await saveClients([...ordered, ...rest]);
}

export async function removeClient(id: string): Promise<void> {
  const clients = await getClients();
  await saveClients(clients.filter((c) => c.id !== id));
}

export interface ScrapeRunResult {
  ok: number;
  failed: number;
  details: { clientId: string; name: string; percentage: number | null; error: string }[];
}

/**
 * Kdyz mame klic widgetu, jdeme pres nej — ta cesta funguje i z cloudu,
 * protoze neni za Cloudflare. Bez klice (nebo kdyz widget selze) zbyva
 * profil obchodu, ktery projde jen ze site, ktere Heureka veri.
 */
async function nactiObchod(client: Client): Promise<ScrapeResult> {
  if (!client.widgetKey) return scrapeShop(client.url);

  try {
    return await scrapeWidget(
      client.widgetKey,
      client.market,
      client.slug,
      client.name,
      client.url,
      client.logoUrl,
    );
  } catch {
    // Kdyz widget nic nevrati, zbyva profil obchodu — ten ale projde
    // jen ze site, ktere Heureka veri.
    return scrapeShop(client.url);
  }
}

export async function runScrape(): Promise<ScrapeRunResult> {
  const clients = (await getClients()).filter((c) => c.active);
  const stamp = new Date().toISOString();
  const date = today();
  const snapshots: Snapshot[] = [];
  const details: ScrapeRunResult["details"] = [];
  const updated: Client[] = [];
  let changed = false;

  for (const [index, client] of clients.entries()) {
    // Heureku nezahlcujeme — jdeme sekvencne s pauzou mezi obchody.
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const scraped = await nactiObchod(client);
      snapshots.push({
        date,
        clientId: client.id,
        clientName: scraped.name,
        market: client.market,
        percentage: scraped.percentage,
        certificate: scraped.certificate,
        rating: scraped.rating,
        reviewCount: scraped.reviewCount,
        scrapedAt: stamp,
        error: "",
      });
      details.push({
        clientId: client.id,
        name: scraped.name,
        percentage: scraped.percentage,
        error: "",
      });

      if (scraped.name !== client.name || scraped.logoUrl !== client.logoUrl) {
        changed = true;
        updated.push({ ...client, name: scraped.name, logoUrl: scraped.logoUrl });
      } else {
        updated.push(client);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Neznama chyba";
      snapshots.push({
        date,
        clientId: client.id,
        clientName: client.name,
        market: client.market,
        percentage: null,
        certificate: "none",
        rating: null,
        reviewCount: null,
        scrapedAt: stamp,
        error: message,
      });
      details.push({ clientId: client.id, name: client.name, percentage: null, error: message });
      updated.push(client);
    }
  }

  await saveSnapshots(snapshots);

  if (changed) {
    const all = await getClients();
    const byId = new Map(updated.map((c) => [c.id, c]));
    await saveClients(all.map((c) => byId.get(c.id) ?? c));
  }

  return {
    ok: details.filter((d) => !d.error).length,
    failed: details.filter((d) => d.error).length,
    details,
  };
}
