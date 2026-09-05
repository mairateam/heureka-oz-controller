/**
 * Najde a overi widget klic ("sak") pro kazdeho klienta a ulozi ho do tabulky.
 *
 * Klic visi na webu kazdeho e-shopu, ktery ma na strankach widget
 * Overeno zakazniky. Adresu webu vytahneme z profilu obchodu na Heurece.
 *
 * Pousti se ze site, ktere Heureka veri (profily obchodu jsou za Cloudflare):
 *   npm run keys           najde, overi a ulozi
 *   npm run keys -- --dry  jen vypise, nic neulozi
 *
 * Vypise, u kterych obchodu klic chybi — ty je potreba dodat rucne
 * z administrace Overeno zakazniky.
 */
import { fetchHtml } from "../src/lib/fetchHtml";
import { scrapeWidget } from "../src/lib/heurekaWidget";
import { getClients, saveClients } from "../src/lib/store";
import type { Client } from "../src/lib/types";

async function najdiWebObchodu(heurekaUrl: string): Promise<string | null> {
  const { status, body } = await fetchHtml(heurekaUrl, {
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "cs-CZ,cs;q=0.9",
  });
  if (status !== 200) return null;

  // V sekci Kontakty je adresa e-shopu primo textem odkazu (href vede
  // na prekliky Heureky, ktere nas nezajimaji).
  const web = body.match(
    /c-pair-list__key">Web<\/dt>[\s\S]{0,800}?<a[^>]*>\s*(https?:\/\/[^<\s]+?)\s*<\/a>/,
  );
  if (!web) return null;

  try {
    return new URL(web[1]).origin;
  } catch {
    return null;
  }
}

async function najdiKlic(webUrl: string): Promise<string | null> {
  const { status, body } = await fetchHtml(webUrl, {
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "cs-CZ,cs;q=0.9",
  });
  if (status !== 200) return null;

  return (
    body.match(/gjs\.php\?n=wdgt&(?:amp;)?sak=([A-Za-z0-9]+)/)?.[1] ??
    body.match(/_hwq\.push\(\['setKey',\s*'([A-Za-z0-9]+)'\]\)/)?.[1] ??
    null
  );
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry");
  const clients = await getClients();
  console.log(`Hledam widget klice pro ${clients.length} obchodu.\n`);

  const aktualizovani: Client[] = [];
  const chybejici: string[] = [];

  for (const [index, client] of clients.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, 1500));

    if (client.widgetKey) {
      console.log(`  ma      ${client.name}: klic uz je ulozeny`);
      aktualizovani.push(client);
      continue;
    }

    try {
      const web = await najdiWebObchodu(client.url);
      if (!web) {
        console.log(`  ?       ${client.name}: nenasel jsem adresu e-shopu`);
        chybejici.push(client.name);
        aktualizovani.push(client);
        continue;
      }

      const key = await najdiKlic(web);
      if (!key) {
        console.log(`  chybi   ${client.name} (${web}): widget na webu neni`);
        chybejici.push(`${client.name} — ${web}`);
        aktualizovani.push(client);
        continue;
      }

      // Klic hned overime — vypnuty widget nebo klic z jineho trhu je k nicemu.
      try {
        const data = await scrapeWidget(
          key,
          client.market,
          client.slug,
          client.name,
          client.url,
          client.logoUrl,
        );
        console.log(`  ok      ${client.name}: ${data.percentage} %, ${data.certificate}`);
        aktualizovani.push({ ...client, widgetKey: key });
      } catch (error) {
        const duvod = error instanceof Error ? error.message : String(error);
        console.log(`  nefunk. ${client.name}: klic nalezen, ale ${duvod}`);
        chybejici.push(`${client.name} — klíč nalezen, ale ${duvod}`);
        aktualizovani.push(client);
      }
    } catch (error) {
      console.log(`  CHYBA   ${client.name}: ${error instanceof Error ? error.message : error}`);
      chybejici.push(client.name);
      aktualizovani.push(client);
    }
  }

  const sKlicem = aktualizovani.filter((c) => c.widgetKey).length;
  console.log(`\n=== Funkcni klic ma ${sKlicem} z ${clients.length} obchodu ===`);

  if (chybejici.length > 0) {
    console.log(`\n=== Klic bude potreba dodat rucne (${chybejici.length}) ===`);
    for (const jmeno of chybejici) console.log(`  ${jmeno}`);
  }

  if (dry) {
    console.log("\n--dry: do tabulky jsem nic nezapsal.");
    return;
  }

  await saveClients(aktualizovani);
  console.log("\nKlice ulozeny do tabulky (sloupec widget_key).");
}

main().catch((error) => {
  console.error("Selhalo:", error instanceof Error ? error.message : error);
  process.exit(1);
});
