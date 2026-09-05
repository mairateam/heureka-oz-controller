/**
 * Scrape spusteny mimo webove rozhrani — bezi v GitHub Actions jednou denne.
 * Pouziva stejnou logiku jako tlacitko "Spustit kontrolu" v dashboardu,
 * takze se obe cesty nemuzou rozejit.
 *
 * Lokalne:  npm run scrape
 * V CI:     promenne prijdou z GitHub Secrets
 */
import { runScrape } from "../src/lib/data";
import { backend } from "../src/lib/store";

async function main(): Promise<void> {
  const started = Date.now();

  if (backend() !== "sheets") {
    console.error(
      "Chybi promenne pro Google Sheets — bez nich by scrape zapsal do lokalniho souboru, " +
        "coz v CI nedava smysl. Zkontroluj GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL " +
        "a GOOGLE_PRIVATE_KEY.",
    );
    process.exit(1);
  }

  const result = await runScrape();
  const seconds = Math.round((Date.now() - started) / 1000);

  for (const detail of result.details) {
    console.log(
      detail.error
        ? `  CHYBA  ${detail.name}: ${detail.error}`
        : `  ok     ${detail.name}: ${detail.percentage} %`,
    );
  }

  console.log(`\nHotovo za ${seconds} s — nacteno ${result.ok}, selhalo ${result.failed}.`);

  // Kdyz selhalo uplne vsechno, chceme o tom v Actions vedet (cerveny beh).
  // Jednotlive vypadky jsou normalni a zapisi se do tabulky jako radek s chybou.
  if (result.failed > 0 && result.ok === 0) {
    console.error("\nNepodarilo se nacist ani jeden obchod — necham beh spadnout.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nScrape spadl:", error instanceof Error ? error.message : error);
  process.exit(1);
});
