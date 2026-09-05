#!/usr/bin/env node
/**
 * Z JSON klice service accountu a odkazu na tabulku vyrobi .env.local.
 * Rucni prepisovani privatniho klice je nejcastejsi zdroj chyb pri napojeni.
 *
 *   node scripts/setup-google.mjs "C:\\Users\\Ondrej\\Downloads\\klic.json" "<odkaz nebo ID tabulky>"
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";

const [keyPath, sheetInput] = process.argv.slice(2);

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!keyPath || !sheetInput) {
  fail(
    'Pouziti: node scripts/setup-google.mjs "<cesta k JSON klici>" "<odkaz nebo ID tabulky>"',
  );
}

if (!existsSync(keyPath)) {
  fail(`Soubor ${keyPath} neexistuje.`);
}

let key;
try {
  key = JSON.parse(readFileSync(keyPath, "utf8"));
} catch {
  fail("Soubor s klicem se nepodarilo precist jako JSON.");
}

if (!key.client_email || !key.private_key) {
  fail("V JSONu chybi client_email nebo private_key — je to opravdu klic service accountu?");
}

// Prijmeme cely odkaz i holé ID.
const sheetId = sheetInput.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? sheetInput.trim();
if (!/^[a-zA-Z0-9-_]{20,}$/.test(sheetId)) {
  fail(`Z "${sheetInput}" jsem nevytahl ID tabulky. Vloz cely odkaz na tabulku.`);
}

const envPath = path.join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  copyFileSync(envPath, `${envPath}.bak`);
  console.log("  Puvodni .env.local jsem zazalohoval jako .env.local.bak");
}

// Skutecne konce radku v klici zapisujeme jako \n, aplikace si je prevede zpet.
const escapedKey = key.private_key.replace(/\n/g, "\\n");

writeFileSync(
  envPath,
  [
    `GOOGLE_SHEET_ID=${sheetId}`,
    `GOOGLE_SERVICE_ACCOUNT_EMAIL=${key.client_email}`,
    `GOOGLE_PRIVATE_KEY="${escapedKey}"`,
    "",
  ].join("\n"),
  "utf8",
);

console.log(`
  Hotovo, .env.local je vyplneny.

  Jeste posledni krok — v Google tabulce dej Sdilet a pridej tenhle e-mail
  s opravnenim Editor:

      ${key.client_email}

  Pak restartuj aplikaci (zavri okno a spust zastupce Heureka_OZ znovu).
`);
