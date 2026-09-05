import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboard } from "@/lib/data";
import { CertificateBadge } from "@/components/CertificateBadge";
import { Trend } from "@/components/Trend";
import { HistoryChart } from "@/components/HistoryChart";

export const dynamic = "force-dynamic";

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = (await getDashboard()).find((c) => c.id === decodeURIComponent(id));
  if (!client) notFound();

  const points = client.history
    .filter((s) => s.percentage !== null)
    .map((s) => ({ date: s.date, value: s.percentage as number }));

  const rows = [...client.history].reverse();

  return (
    <>
      <div style={{ padding: "32px 0 24px" }}>
        <Link href="/" style={{ color: "var(--muted)", fontSize: 13 }}>
          ← Zpět na přehled
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
          {client.logoUrl ? (
            <div
              style={{
                background: "#fff",
                borderRadius: 6,
                padding: 8,
                width: 110,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={client.logoUrl}
                alt={client.name}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </div>
          ) : null}
          <div>
            <h1>{client.name}</h1>
            <a
              href={client.url}
              target="_blank"
              rel="noreferrer"
              className="label"
              style={{ color: "var(--muted)" }}
            >
              Heureka.{client.market} ↗
            </a>
          </div>
        </div>
      </div>

      <section
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          marginBottom: 26,
        }}
      >
        <div className="card">
          <p className="label">Aktuální spokojenost</p>
          <p style={{ fontSize: 40, fontWeight: 600, margin: "6px 0 8px", lineHeight: 1 }}>
            {client.latest?.percentage ?? "—"} <span style={{ fontSize: 20 }}>%</span>
          </p>
          <Trend
            current={client.latest?.percentage ?? null}
            previous={client.previous?.percentage ?? null}
          />
        </div>
        <div className="card">
          <p className="label">Certifikát</p>
          <div style={{ marginTop: 14 }}>
            <CertificateBadge certificate={client.latest?.certificate ?? "none"} />
          </div>
        </div>
        <div className="card">
          <p className="label">Hodnocení obchodu</p>
          <p style={{ fontSize: 32, fontWeight: 600, margin: "6px 0 0", lineHeight: 1 }}>
            {client.latest?.rating ?? "—"} <span style={{ fontSize: 16 }}>/ 5</span>
          </p>
        </div>
        <div className="card">
          <p className="label">Počet recenzí</p>
          <p style={{ fontSize: 32, fontWeight: 600, margin: "6px 0 0", lineHeight: 1 }}>
            {client.latest?.reviewCount?.toLocaleString("cs-CZ") ?? "—"}
          </p>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 26 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Vývoj spokojenosti</h2>
        <HistoryChart series={[{ name: client.name, color: "#ff4a21", points }]} />
      </section>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Spokojenost</th>
              <th>Certifikát</th>
              <th>Hodnocení</th>
              <th>Recenze</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)" }}>
                  Zatím žádná měření.
                </td>
              </tr>
            ) : (
              rows.map((snapshot) => (
                <tr key={snapshot.date}>
                  <td>{formatDate(snapshot.date)}</td>
                  <td>
                    {snapshot.error ? (
                      <span style={{ color: "var(--accent)" }}>chyba</span>
                    ) : (
                      `${snapshot.percentage} %`
                    )}
                  </td>
                  <td>
                    <CertificateBadge certificate={snapshot.certificate} />
                  </td>
                  <td style={{ color: "var(--muted)" }}>{snapshot.rating ?? "—"}</td>
                  <td style={{ color: "var(--muted)" }}>
                    {snapshot.reviewCount?.toLocaleString("cs-CZ") ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
