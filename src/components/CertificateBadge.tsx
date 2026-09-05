import type { Certificate } from "@/lib/types";

const LABELS: Record<Certificate, { text: string; color: string }> = {
  gold: { text: "Zlatý certifikát", color: "var(--gold)" },
  blue: { text: "Modrý certifikát", color: "var(--blue)" },
  none: { text: "Bez certifikátu", color: "rgba(255,255,255,0.35)" },
};

export function CertificateBadge({ certificate }: { certificate: Certificate }) {
  const { text, color } = LABELS[certificate] ?? LABELS.none;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 12,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: certificate === "none" ? "var(--faint)" : color,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: certificate === "none" ? "transparent" : color,
          border: certificate === "none" ? "1px solid rgba(255,255,255,0.3)" : "none",
        }}
      />
      {text}
    </span>
  );
}
