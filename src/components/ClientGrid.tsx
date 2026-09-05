"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CertificateBadge } from "./CertificateBadge";
import { Trend } from "./Trend";
import type { ClientCardData } from "@/lib/types";

/** 1 recenze, 2-4 recenze, 5+ recenzi. */
function reviewLabel(count: number): string {
  if (count === 1) return "recenze";
  if (count >= 2 && count <= 4) return "recenze";
  return "recenzí";
}

function formatDateTime(iso: string): string {
  if (!iso) return "zatím bez měření";
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  }).format(new Date(iso));
}

export function ClientGrid({ clients }: { clients: ClientCardData[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(clients);
  const [dragId, setDragId] = useState<string | null>(null);
  const orderDirty = useRef(false);

  // Nova data ze serveru prevezmeme, jen kdyz zrovna neprebiha presouvani.
  useEffect(() => {
    if (!dragId) setItems(clients);
  }, [clients, dragId]);

  function reorder(overId: string) {
    if (!dragId || dragId === overId) return;
    setItems((current) => {
      const from = current.findIndex((c) => c.id === dragId);
      const to = current.findIndex((c) => c.id === overId);
      if (from === -1 || to === -1) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      orderDirty.current = true;
      return next;
    });
  }

  async function persistOrder(order: ClientCardData[]) {
    if (!orderDirty.current) return;
    orderDirty.current = false;
    await fetch("/api/clients/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: order.map((c) => c.id) }),
    });
    router.refresh();
  }

  async function remove(client: ClientCardData) {
    if (!window.confirm(`Odebrat ${client.name} z přehledu? Historie v tabulce zůstane.`)) return;
    setItems((current) => current.filter((c) => c.id !== client.id));
    await fetch(`/api/clients/${encodeURIComponent(client.id)}`, { method: "DELETE" });
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }}>
        Zatím tu nikdo není. Přidej prvního klienta tlačítkem nahoře — stačí odkaz na jeho profil,
        třeba <code>https://obchody.heureka.cz/notino-cz/</code>.
      </p>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
          minHeight: 30,
        }}
      >
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          {editing ? "Přetáhni dlaždice na požadované pořadí." : ""}
        </span>
        <button
          className={editing ? "btn" : "btn btn--quiet"}
          type="button"
          onClick={() => {
            if (editing) void persistOrder(items);
            setEditing(!editing);
          }}
          title={editing ? "Ukončit úpravy" : "Upravit rozložení a odebírat klienty"}
        >
          {editing ? "Hotovo" : "•••"}
        </button>
      </div>

      <div className="tiles">
        {items.map((client) => (
          <article
            key={client.id}
            className={`card card--tile${client.certificate === "none" ? " card--alert" : ""}`}
            draggable={editing}
            onDragStart={() => setDragId(client.id)}
            onDragEnd={() => {
              setDragId(null);
              void persistOrder(items);
            }}
            onDragOver={(event) => {
              if (!editing || !dragId) return;
              event.preventDefault();
              reorder(client.id);
            }}
            style={{
              display: "grid",
              cursor: editing ? "grab" : "default",
              opacity: dragId === client.id ? 0.45 : 1,
              outline: editing ? "1px dashed rgba(255,255,255,0.18)" : "none",
              outlineOffset: 3,
            }}
          >
            <header style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {editing ? (
                  <span aria-hidden style={{ color: "var(--faint)", fontSize: 18, lineHeight: 1 }}>
                    ⠿
                  </span>
                ) : null}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 6,
                    padding: 5,
                    width: 70,
                    height: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {client.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={client.logoUrl}
                      alt={client.name}
                      draggable={false}
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <span style={{ color: "#083027", fontSize: 11 }}>
                      {client.name.slice(0, 10)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 14, lineHeight: 1.2 }}>
                  {editing ? (
                    client.name
                  ) : (
                    <Link href={`/klient/${encodeURIComponent(client.id)}`}>{client.name}</Link>
                  )}
                </h2>
                <span className="label">Heureka.{client.market}</span>
              </div>
            </header>

            <div style={{ display: "grid", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
                <span style={{ fontSize: 30, fontWeight: 600, lineHeight: 1 }}>
                  {client.percentage ?? "—"}
                  <span style={{ fontSize: 16, color: "var(--muted)" }}> %</span>
                </span>
                <Trend current={client.percentage} previous={client.previousPercentage} />
              </div>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {client.rating !== null ? `${client.rating.toLocaleString("cs-CZ")} / 5` : null}
                {client.rating !== null && client.reviewCount !== null ? " · " : null}
                {client.reviewCount !== null
                  ? `${client.reviewCount.toLocaleString("cs-CZ")} ${reviewLabel(client.reviewCount)}`
                  : null}
              </span>
            </div>

            <CertificateBadge certificate={client.certificate} />

            {client.error ? (
              <p style={{ color: "var(--accent)", fontSize: 13, margin: 0 }}>
                Poslední kontrola selhala: {client.error}
              </p>
            ) : null}

            <footer
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                borderTop: "1px solid var(--border)",
                paddingTop: 10,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--faint)" }}>
                {formatDateTime(client.scrapedAt)}
              </span>
              {editing ? (
                <button className="btn btn--quiet" type="button" onClick={() => remove(client)}>
                  Odebrat
                </button>
              ) : (
                <Link className="btn btn--quiet" href={`/klient/${encodeURIComponent(client.id)}`}>
                  Historie
                </Link>
              )}
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
