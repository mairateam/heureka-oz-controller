import { getDashboard } from "@/lib/data";
import { backend } from "@/lib/store";
import { AddClientButton, ScrapeButton } from "@/components/ClientActions";
import { ClientGrid } from "@/components/ClientGrid";
import type { ClientCardData } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  }).format(new Date(iso));
}

export default async function DashboardPage() {
  const clients = await getDashboard();
  const usingLocal = backend() === "local";

  const lastRun = clients
    .map((c) => c.latest?.scrapedAt ?? "")
    .filter(Boolean)
    .sort()
    .at(-1);

  const withValue = clients.filter((c) => c.latest?.percentage != null);
  const average =
    withValue.length > 0
      ? Math.round(
          (withValue.reduce((sum, c) => sum + (c.latest?.percentage ?? 0), 0) / withValue.length) *
            10,
        ) / 10
      : null;

  // Do dlazdic posilame jen to, co karta opravdu potrebuje — ne celou historii.
  const cards: ClientCardData[] = clients.map((client) => ({
    id: client.id,
    name: client.name,
    market: client.market,
    logoUrl: client.logoUrl,
    percentage: client.latest?.percentage ?? null,
    previousPercentage: client.previous?.percentage ?? null,
    certificate: client.latest?.certificate ?? "none",
    rating: client.latest?.rating ?? null,
    reviewCount: client.latest?.reviewCount ?? null,
    scrapedAt: client.latest?.scrapedAt ?? "",
    error: client.latest?.error ?? "",
  }));

  // Obchody bez certifikatu nahoru jako upozorneni. Razeni je stabilni,
  // takze uvnitr obou skupin plati poradi, ktere si uzivatel natahal.
  cards.sort((a, b) => Number(a.certificate !== "none") - Number(b.certificate !== "none"));

  return (
    <>
      <div
        style={{
          padding: "40px 0 28px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>Spokojenost klientů</h1>
          <p style={{ color: "var(--muted)", margin: "8px 0 0", fontSize: 14 }}>
            {clients.length} {clients.length === 1 ? "obchod" : "obchodů"} · průměr{" "}
            {average === null ? "—" : `${average} %`} · poslední kontrola{" "}
            {lastRun ? formatDateTime(lastRun) : "zatím žádná"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <ScrapeButton />
          <AddClientButton />
        </div>
      </div>

      {usingLocal ? (
        <div className="notice" style={{ marginBottom: 20 }}>
          <strong>Google Sheet zatím není napojený.</strong> Data se ukládají lokálně do{" "}
          <code>data/local-store.json</code>. Návod na napojení najdeš v README, sekce „Napojení
          Google Sheets“.
        </div>
      ) : null}

      <ClientGrid clients={cards} />
    </>
  );
}
