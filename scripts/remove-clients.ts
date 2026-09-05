/**
 * Odstrani obchody z prehledu vcetne jejich historie.
 *
 *   npm run remove -- --dry <id> [<id> ...]   jen vypise, co by smazal
 *   npm run remove -- <id> [<id> ...]         smaze
 *
 * Pred zapisem vzdy ulozi zalohu cele tabulky do clients-backup-*.json.
 */
import { writeFileSync } from "node:fs";
import { getClients, getSnapshots, saveClients } from "../src/lib/store";
import { replaceSnapshots, sheetsConfigured } from "../src/lib/sheets";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const ids = args.filter((a) => a !== "--dry");

  if (ids.length === 0) {
    console.error("Zadej aspon jedno id obchodu.");
    process.exit(1);
  }

  if (!sheetsConfigured()) {
    console.error("Tenhle skript pracuje s Google Sheetem — chybi promenne z .env.local.");
    process.exit(1);
  }

  const [clients, snapshots] = await Promise.all([getClients(), getSnapshots()]);

  const kMazani = clients.filter((c) => ids.includes(c.id));
  const nenalezene = ids.filter((id) => !clients.some((c) => c.id === id));

  if (nenalezene.length > 0) {
    console.error(`Tahle id v tabulce nejsou: ${nenalezene.join(", ")}`);
    console.error("K dispozici:");
    for (const c of clients) console.error(`  ${c.id}  (${c.name})`);
    process.exit(1);
  }

  console.log("Ke smazani:");
  for (const c of kMazani) {
    const pocet = snapshots.filter((s) => s.clientId === c.id).length;
    console.log(`  ${c.name} (${c.id}) — ${pocet} zaznamu historie`);
  }

  const zbylikClienti = clients.filter((c) => !ids.includes(c.id));
  const zbylySnapshoty = snapshots.filter((s) => !ids.includes(s.clientId));

  console.log(
    `\nZbyde ${zbylikClienti.length} obchodu (z ${clients.length}) ` +
      `a ${zbylySnapshoty.length} zaznamu (z ${snapshots.length}).`,
  );

  if (dry) {
    console.log("\n--dry: nic jsem nesmazal.");
    return;
  }

  const zaloha = `clients-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  writeFileSync(zaloha, JSON.stringify({ clients, snapshots }, null, 2), "utf8");
  console.log(`\nZaloha ulozena do ${zaloha}`);

  await saveClients(zbylikClienti);
  await replaceSnapshots(zbylySnapshoty);
  console.log("Hotovo.");
}

main().catch((error) => {
  console.error("Selhalo:", error instanceof Error ? error.message : error);
  process.exit(1);
});
