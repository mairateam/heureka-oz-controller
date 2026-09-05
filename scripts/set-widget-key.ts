/**
 * Rucni doplneni widget klice u obchodu, ktery ho nema na webu
 * (bere se z administrace Overeno zakazniky).
 *
 *   npm run key -- <cast nazvu nebo id klienta> <klic>
 *
 * Klic se pred ulozenim overi — vypnuty widget nebo klic z jineho trhu
 * se do tabulky nedostane.
 */
import { scrapeWidget, WidgetVypnuty } from "../src/lib/heurekaWidget";
import { getClients, saveClients } from "../src/lib/store";

async function main(): Promise<void> {
  const [hledany, klic] = process.argv.slice(2);

  if (!hledany || !klic) {
    console.error('Pouziti: npm run key -- "<cast nazvu nebo id>" "<klic>"');
    process.exit(1);
  }

  const clients = await getClients();
  const potvrzeni = hledany.toLowerCase();
  const nalezeni = clients.filter(
    (c) => c.id.toLowerCase().includes(potvrzeni) || c.name.toLowerCase().includes(potvrzeni),
  );

  if (nalezeni.length === 0) {
    console.error(`Zadny obchod neodpovida "${hledany}". K dispozici:`);
    for (const c of clients) console.error(`  ${c.id}  (${c.name})`);
    process.exit(1);
  }

  if (nalezeni.length > 1) {
    console.error(`"${hledany}" odpovida vic obchodum, upresni:`);
    for (const c of nalezeni) console.error(`  ${c.id}  (${c.name})`);
    process.exit(1);
  }

  const client = nalezeni[0];
  console.log(`Overuji klic pro ${client.name} (${client.id}, heureka.${client.market})...`);

  try {
    const data = await scrapeWidget(
      klic,
      client.market,
      client.slug,
      client.name,
      client.url,
      client.logoUrl,
    );
    console.log(
      `  OK — ${data.percentage} %, ${data.certificate}, ${data.reviewCount ?? "?"} recenzi`,
    );
  } catch (error) {
    if (!(error instanceof WidgetVypnuty)) {
      console.error(`  NEFUNGUJE — ${error instanceof Error ? error.message : error}`);
      console.error("  Klic jsem neulozil.");
      process.exit(1);
    }
    // Klic si necháme — az obchod certifikat ziska, widget se zapne
    // a my se to dozvime i z cloudu.
    console.log("  Obchod zatim nema certifikat, widget je vypnuty.");
    console.log("  Klic presto ulozim — pozna se podle nej, az certifikat ziska.");
  }

  await saveClients(clients.map((c) => (c.id === client.id ? { ...c, widgetKey: klic } : c)));
  console.log("Klic ulozen do tabulky.");
}

main().catch((error) => {
  console.error("Selhalo:", error instanceof Error ? error.message : error);
  process.exit(1);
});
