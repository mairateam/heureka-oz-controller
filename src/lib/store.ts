import { promises as fs } from "node:fs";
import path from "node:path";
import type { Client, Snapshot } from "./types";
import * as sheets from "./sheets";

/**
 * Data ziji v Google Sheetu. Dokud neni napojeny, aplikace bezi proti
 * lokalnimu JSON souboru, aby sla vyzkouset hned po `npm run dev`.
 */
export type Backend = "sheets" | "local";

export function backend(): Backend {
  return sheets.sheetsConfigured() ? "sheets" : "local";
}

const LOCAL_FILE = path.join(process.cwd(), "data", "local-store.json");

interface LocalData {
  clients: Client[];
  snapshots: Snapshot[];
}

async function readLocal(): Promise<LocalData> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalData>;
    return { clients: parsed.clients ?? [], snapshots: parsed.snapshots ?? [] };
  } catch {
    return { clients: [], snapshots: [] };
  }
}

async function writeLocal(data: LocalData): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function getClients(): Promise<Client[]> {
  if (backend() === "sheets") {
    await sheets.ensureSheets();
    return sheets.readClients();
  }
  return (await readLocal()).clients;
}

export async function saveClients(clients: Client[]): Promise<void> {
  if (backend() === "sheets") {
    await sheets.ensureSheets();
    await sheets.writeClients(clients);
    return;
  }
  const data = await readLocal();
  await writeLocal({ ...data, clients });
}

export async function getSnapshots(): Promise<Snapshot[]> {
  if (backend() === "sheets") {
    await sheets.ensureSheets();
    return sheets.readSnapshots();
  }
  return (await readLocal()).snapshots;
}

/**
 * Na jeden obchod a den drzime prave jeden zaznam. Neuspesny scrape
 * neprepise uspesne mereni z tehoz dne.
 */
export async function saveSnapshots(snapshots: Snapshot[]): Promise<void> {
  if (snapshots.length === 0) return;

  if (backend() === "sheets") {
    await sheets.ensureSheets();
    await sheets.upsertSnapshots(snapshots);
    return;
  }

  const data = await readLocal();
  const merged = [...data.snapshots];

  for (const snapshot of snapshots) {
    const index = merged.findIndex(
      (s) => s.clientId === snapshot.clientId && s.date === snapshot.date,
    );
    if (index === -1) {
      merged.push(snapshot);
    } else if (snapshot.percentage !== null || merged[index].percentage === null) {
      merged[index] = snapshot;
    }
  }

  await writeLocal({ ...data, snapshots: merged });
}
