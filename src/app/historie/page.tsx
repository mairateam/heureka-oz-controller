import Link from "next/link";
import { getDashboard } from "@/lib/data";
import { HistoryChart, SERIES_COLORS, type ChartSeries } from "@/components/HistoryChart";
import { CertificateBadge } from "@/components/CertificateBadge";

export const dynamic = "force-dynamic";

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

export default async function HistoryPage() {
  const clients = await getDashboard();

  const series: ChartSeries[] = clients
    .map((client, index) => ({
      name: client.name,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      points: client.history
        .filter((s) => s.percentage !== null)
        .map((s) => ({ date: s.date, value: s.percentage as number })),
    }))
    .filter((s) => s.points.length > 0);

  // Radky tabulky: jeden radek na den, sloupec na klienta.
  const dates = [...new Set(clients.flatMap((c) => c.history.map((s) => s.date)))].sort().reverse();

  return (
    <>
      <div style={{ padding: "40px 0 24px" }}>
        <h1>Historie všech klientů</h1>
        <p style={{ color: "var(--muted)", margin: "8px 0 0", fontSize: 14 }}>
          Každý den jeden záznam na obchod. Kliknutím na jméno se dostaneš na detail.
        </p>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Srovnání</h2>
        <HistoryChart series={series} height={340} />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 20px",
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          {series.map((s) => (
            <span
              key={s.name}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}
            >
              <span
                aria-hidden
                style={{ width: 14, height: 3, background: s.color, borderRadius: 2 }}
              />
              {s.name}
            </span>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              {clients.map((client) => (
                <th key={client.id}>
                  <Link href={`/klient/${encodeURIComponent(client.id)}`}>{client.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.length === 0 ? (
              <tr>
                <td colSpan={clients.length + 1} style={{ color: "var(--muted)" }}>
                  Zatím žádná měření. Spusť kontrolu na přehledu.
                </td>
              </tr>
            ) : (
              dates.map((date) => (
                <tr key={date}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(date)}</td>
                  {clients.map((client) => {
                    const snapshot = client.history.find((s) => s.date === date);
                    if (!snapshot) {
                      return (
                        <td key={client.id} style={{ color: "var(--faint)" }}>
                          —
                        </td>
                      );
                    }
                    if (snapshot.error) {
                      return (
                        <td key={client.id} style={{ color: "var(--accent)" }} title={snapshot.error}>
                          chyba
                        </td>
                      );
                    }
                    return (
                      <td key={client.id}>
                        <div style={{ display: "grid", gap: 3 }}>
                          <span>{snapshot.percentage} %</span>
                          <CertificateBadge certificate={snapshot.certificate} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
