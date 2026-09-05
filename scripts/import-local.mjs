#!/usr/bin/env node
/**
 * Jednorazovy prenos dat z data/local-store.json do napojeneho Google Sheetu.
 * Pousti se po tom, co appka zacala jet proti Sheetu, aby se klienti
 * nasbirani v lokalnim rezimu nemuseli zadavat znovu.
 *
 *   node --env-file=.env.local scripts/import-local.mjs
 *
 * Je idempotentni — co uz v tabulce je, preskoci.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

const CLIENTS = "Clients";
const SNAPSHOTS = "Snapshots";

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error("\n  Chybi promenne z .env.local — spust skript s --env-file=.env.local\n");
  process.exit(1);
}

const storePath = path.join(process.cwd(), "data", "local-store.json");
if (!existsSync(storePath)) {
  console.error(`\n  ${storePath} neexistuje, neni co prenaset.\n`);
  process.exit(1);
}

const store = JSON.parse(readFileSync(storePath, "utf8"));
const localClients = store.clients ?? [];
const localSnapshots = store.snapshots ?? [];

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const api = google.sheets({ version: "v4", auth });

async function rows(title) {
  const res = await api.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:Z` });
  return res.data.values ?? [];
}

async function append(title, values) {
  if (values.length === 0) return;
  await api.spreadsheets.values.append({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

const existingClientIds = new Set((await rows(CLIENTS)).map((r) => r[0]));
const existingSnapshots = new Set((await rows(SNAPSHOTS)).map((r) => `${r[1]}|${r[0]}|${r[8]}`));

const newClients = localClients.filter((c) => !existingClientIds.has(c.id));
const newSnapshots = localSnapshots.filter(
  (s) => !existingSnapshots.has(`${s.clientId}|${s.date}|${s.scrapedAt}`),
);

await append(
  CLIENTS,
  newClients.map((c) => [
    c.id,
    c.name,
    c.market,
    c.slug,
    c.url,
    c.logoUrl,
    c.addedAt,
    c.active ? "TRUE" : "FALSE",
  ]),
);

await append(
  SNAPSHOTS,
  newSnapshots.map((s) => [
    s.date,
    s.clientId,
    s.clientName,
    s.market,
    s.percentage ?? "",
    s.certificate,
    s.rating ?? "",
    s.reviewCount ?? "",
    s.scrapedAt,
    s.error ?? "",
  ]),
);

console.log(`
  Preneseno do tabulky:
    klienti   ${newClients.length} novych (${localClients.length - newClients.length} uz tam bylo)
    zaznamy   ${newSnapshots.length} novych (${localSnapshots.length - newSnapshots.length} uz tam bylo)
`);
