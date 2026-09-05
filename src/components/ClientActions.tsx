"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Chyba ${response.status}`;
  } catch {
    return `Chyba ${response.status}`;
  }
}

export function AddClientButton() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function open() {
    setUrl("");
    setError("");
    dialogRef.current?.showModal();
  }

  function close() {
    if (busy) return;
    dialogRef.current?.close();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (response.ok) {
      setUrl("");
      dialogRef.current?.close();
      router.refresh();
    } else {
      setError(await readError(response));
    }
    setBusy(false);
  }

  return (
    <>
      <button className="btn" type="button" onClick={open}>
        Přidat klienta
      </button>

      <dialog
        ref={dialogRef}
        className="modal"
        onCancel={(event) => {
          // Behem odesilani nechceme, aby Esc zavrel okno pod rukama.
          if (busy) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 18 }}>Přidat klienta</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
              Vlož odkaz na profil obchodu na Heurece CZ nebo SK.
            </p>
          </div>

          <input
            className="input"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://obchody.heureka.cz/nazev-obchodu/"
            aria-label="URL obchodu na Heurece"
            autoFocus
            required
          />

          {error ? <p style={{ color: "var(--accent)", fontSize: 13, margin: 0 }}>{error}</p> : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button className="btn btn--ghost" type="button" onClick={close} disabled={busy}>
              Zrušit
            </button>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Přidávám…" : "Přidat"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function ScrapeButton() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setStatus("");

    const response = await fetch("/api/scrape", { method: "POST" });

    if (response.ok) {
      const result = (await response.json()) as { ok: number; failed: number };
      setStatus(
        result.failed > 0
          ? `Načteno ${result.ok}, selhalo ${result.failed}`
          : `Načteno ${result.ok} obchodů`,
      );
      router.refresh();
    } else {
      setStatus(await readError(response));
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <button className="btn btn--ghost" onClick={run} disabled={busy} type="button">
        {busy ? "Kontroluji…" : "Spustit kontrolu"}
      </button>
      {status ? <span style={{ color: "var(--muted)", fontSize: 12 }}>{status}</span> : null}
    </div>
  );
}
