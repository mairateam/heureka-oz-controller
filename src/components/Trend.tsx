export function Trend({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) {
    return <span style={{ color: "var(--faint)", fontSize: 13 }}>bez srovnání</span>;
  }

  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) {
    return <span style={{ color: "var(--muted)", fontSize: 13 }}>beze změny</span>;
  }

  return (
    <span style={{ color: delta > 0 ? "var(--accent)" : "var(--blue)", fontSize: 13 }}>
      {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} p. b.
    </span>
  );
}
