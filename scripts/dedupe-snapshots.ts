/**
 * Slouci duplicitni radky v listu Snapshots tak, aby na jeden obchod a den
 * zbyl prave jeden. Potreba jen jednorazove po prechodu na zapis typu upsert,
 * nebo kdyby nekdo nasypal duplicity rucne.
 *
 *   npm run dedupe -- --dry     jen vypise, co by udelal
 *   npm run dedupe              provede zmenu
 */
import { writeFileSync } from "node:fs";
import { getSnapshots } from "../src/lib/store";
import { replaceSnapshots } from "../src/lib/sheets";
import { sheetsConfigured } from "../src/lib/sheets";
import type { Snapshot } from "../src/lib/types";

function pickBetter(a: Snapshot, b: Snapshot): Snapshot {
  // Uspesne mereni ma prednost pred chybou bez ohledu na cas.
  if (a.percentage !== null && b.percentage === null) return a;
  if (b.percentage !== null && a.percentage === null) return b;
  return b.scrapedAt >= a.scrapedAt ? b : a;
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry");

  if (!sheetsConfigured()) {
    console.error("Tenhle skript pracuje s Google Sheetem — chybi promenne z .env.local.");
    process.exit(1);
  }

  const all = await getSnapshots();
  console.log(`V tabulce je ${all.length} radku.`);

  const backup = `snapshots-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  writeFileSync(backup, JSON.stringify(all, null, 2), "utf8");
  console.log(`Zaloha ulozena do ${backup}`);

  const byKey = new Map<string, Snapshot>();
  for (const snapshot of all) {
    const key = `${snapshot.clientId}|${snapshot.date}`;
    const current = byKey.get(key);
    byKey.set(key, current ? pickBetter(current, snapshot) : snapshot);
  }

  const kept = [...byKey.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.clientId.localeCompare(b.clientId),
  );

  console.log(`Po slouceni zbyde ${kept.length} radku (odstranenych ${all.length - kept.length}).`);

  if (dry) {
    console.log("\n--dry: v tabulce se nic nezmenilo.");
    return;
  }

  await replaceSnapshots(kept);
  console.log("Tabulka prepsana.");
}

main().catch((error) => {
  console.error("Selhalo:", error instanceof Error ? error.message : error);
  process.exit(1);
});
