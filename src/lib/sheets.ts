import { google, type sheets_v4 } from "googleapis";
import { JWT } from "google-auth-library";
import type { Client, Market, Snapshot, Certificate } from "./types";

export const CLIENTS_SHEET = "Clients";
export const SNAPSHOTS_SHEET = "Snapshots";

const CLIENT_HEADER = [
  "id",
  "name",
  "market",
  "slug",
  "url",
  "logo_url",
  "added_at",
  "active",
];

const SNAPSHOT_HEADER = [
  "date",
  "client_id",
  "client_name",
  "market",
  "percentage",
  "certificate",
  "rating",
  "review_count",
  "scraped_at",
  "error",
];

export function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

function client(): { api: sheets_v4.Sheets; spreadsheetId: string } {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // V .env je klic na jednom radku, realne konce radku jsou zapsane jako \n.
    key: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    api: google.sheets({ version: "v4", auth }),
    spreadsheetId: process.env.GOOGLE_SHEET_ID as string,
  };
}

/** Zalozi chybejici listy a hlavicky, aby stacilo vytvorit prazdnou tabulku. */
export async function ensureSheets(): Promise<void> {
  const { api, spreadsheetId } = client();
  const meta = await api.spreadsheets.get({ spreadsheetId });
  const existing = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[],
  );

  const missing = [CLIENTS_SHEET, SNAPSHOTS_SHEET].filter((title) => !existing.has(title));
  if (missing.length > 0) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }

  for (const [title, header] of [
    [CLIENTS_SHEET, CLIENT_HEADER],
    [SNAPSHOTS_SHEET, SNAPSHOT_HEADER],
  ] as const) {
    const current = await api.spreadsheets.values.get({
      spreadsheetId,
      range: `${title}!1:1`,
    });
    if (!current.data.values?.[0]?.length) {
      await api.spreadsheets.values.update({
        spreadsheetId,
        range: `${title}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [header as unknown as string[]] },
      });
    }
  }
}

async function readRows(title: string): Promise<string[][]> {
  const { api, spreadsheetId } = client();
  const res = await api.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A2:Z`,
  });
  return (res.data.values ?? []) as string[][];
}

export async function readClients(): Promise<Client[]> {
  return (await readRows(CLIENTS_SHEET))
    .filter((row) => row[0])
    .map((row) => ({
      id: row[0],
      name: row[1] ?? "",
      market: (row[2] as Market) ?? "cz",
      slug: row[3] ?? "",
      url: row[4] ?? "",
      logoUrl: row[5] ?? "",
      addedAt: row[6] ?? "",
      active: (row[7] ?? "TRUE").toUpperCase() !== "FALSE",
    }));
}

/** Klientu jsou jednotky az desitky, takze cely list prepiseme — je to nejmene chybove. */
export async function writeClients(clients: Client[]): Promise<void> {
  const { api, spreadsheetId } = client();
  await api.spreadsheets.values.clear({
    spreadsheetId,
    range: `${CLIENTS_SHEET}!A2:Z`,
  });
  if (clients.length === 0) return;

  await api.spreadsheets.values.update({
    spreadsheetId,
    range: `${CLIENTS_SHEET}!A2`,
    valueInputOption: "RAW",
    requestBody: {
      values: clients.map((c) => [
        c.id,
        c.name,
        c.market,
        c.slug,
        c.url,
        c.logoUrl,
        c.addedAt,
        c.active ? "TRUE" : "FALSE",
      ]),
    },
  });
}

function toSnapshot(row: string[]): Snapshot {
  return {
    date: row[0],
    clientId: row[1],
    clientName: row[2] ?? "",
    market: (row[3] as Market) ?? "cz",
    percentage: row[4] === "" || row[4] == null ? null : Number(row[4]),
    certificate: (row[5] as Certificate) ?? "none",
    rating: row[6] === "" || row[6] == null ? null : Number(row[6]),
    reviewCount: row[7] === "" || row[7] == null ? null : Number(row[7]),
    scrapedAt: row[8] ?? "",
    error: row[9] ?? "",
  };
}

function toRow(s: Snapshot): (string | number)[] {
  return [
    s.date,
    s.clientId,
    s.clientName,
    s.market,
    s.percentage ?? "",
    s.certificate,
    s.rating ?? "",
    s.reviewCount ?? "",
    s.scrapedAt,
    s.error,
  ];
}

export async function readSnapshots(): Promise<Snapshot[]> {
  return (await readRows(SNAPSHOTS_SHEET)).filter((row) => row[0] && row[1]).map(toSnapshot);
}

/**
 * Na jeden obchod a den drzime prave jeden radek. Neuspesny scrape ale
 * nikdy neprepise uspesne mereni z tehoz dne — jinak by odpoledni vypadek
 * Heureky smazal to, co rano proslo.
 */
export async function upsertSnapshots(snapshots: Snapshot[]): Promise<void> {
  if (snapshots.length === 0) return;
  const { api, spreadsheetId } = client();

  const rows = await readRows(SNAPSHOTS_SHEET);
  const rowNumberByKey = new Map<string, number>();
  const existingByKey = new Map<string, Snapshot>();

  rows.forEach((row, index) => {
    if (!row[0] || !row[1]) return;
    const key = `${row[1]}|${row[0]}`;
    rowNumberByKey.set(key, index + 2); // +2 = hlavicka a indexovani od jedne
    existingByKey.set(key, toSnapshot(row));
  });

  const updates: { range: string; values: (string | number)[][] }[] = [];
  const appends: (string | number)[][] = [];

  for (const snapshot of snapshots) {
    const key = `${snapshot.clientId}|${snapshot.date}`;
    const rowNumber = rowNumberByKey.get(key);

    if (rowNumber === undefined) {
      appends.push(toRow(snapshot));
      continue;
    }

    const existing = existingByKey.get(key);
    if (snapshot.percentage === null && existing?.percentage !== null) continue;

    updates.push({
      range: `${SNAPSHOTS_SHEET}!A${rowNumber}:J${rowNumber}`,
      values: [toRow(snapshot)],
    });
  }

  if (updates.length > 0) {
    await api.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }

  if (appends.length > 0) {
    await api.spreadsheets.values.append({
      spreadsheetId,
      range: `${SNAPSHOTS_SHEET}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: appends },
    });
  }
}

/** Prepise cely list Snapshots — pouziva se pri jednorazovem procisteni. */
export async function replaceSnapshots(snapshots: Snapshot[]): Promise<void> {
  const { api, spreadsheetId } = client();
  await api.spreadsheets.values.clear({ spreadsheetId, range: `${SNAPSHOTS_SHEET}!A2:Z` });
  if (snapshots.length === 0) return;

  await api.spreadsheets.values.update({
    spreadsheetId,
    range: `${SNAPSHOTS_SHEET}!A2`,
    valueInputOption: "RAW",
    requestBody: { values: snapshots.map(toRow) },
  });
}
