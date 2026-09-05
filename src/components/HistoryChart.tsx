export interface ChartSeries {
  name: string;
  color: string;
  points: { date: string; value: number }[];
}

const W = 900;
const H = 300;
const PAD = { top: 18, right: 18, bottom: 34, left: 44 };

function formatDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(day)}. ${Number(month)}.`;
}

/**
 * Jednoducha SVG spojnice bez externi knihovny — dat je malo
 * (jedna hodnota na klienta a den) a takhle drzi presne brand.
 */
export function HistoryChart({
  series,
  height = H,
}: {
  series: ChartSeries[];
  height?: number;
}) {
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const values = series.flatMap((s) => s.points.map((p) => p.value));

  if (dates.length === 0 || values.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        Zatím není co vykreslit — spusť kontrolu alespoň dvakrát v různé dny.
      </p>
    );
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Rozpeti drzime aspon 4 body, jinak by sum vypadal jako dramaticky propad.
  const mid = (rawMin + rawMax) / 2;
  const span = Math.max(rawMax - rawMin, 4);
  const min = Math.max(0, Math.floor(mid - span * 0.75));
  const max = Math.min(100, Math.ceil(mid + span * 0.75));
  const range = max - min || 1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const x = (date: string) =>
    PAD.left + (dates.length === 1 ? plotW / 2 : (dates.indexOf(date) / (dates.length - 1)) * plotW);
  const y = (value: number) => PAD.top + plotH - ((value - min) / range) * plotH;

  const ticks = [min, min + range / 2, max];
  const labelStep = Math.ceil(dates.length / 7);

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Vývoj procenta spokojenosti v čase"
      style={{ overflow: "visible" }}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 10}
            y={y(tick) + 4}
            textAnchor="end"
            fontSize={11}
            fill="rgba(255,255,255,0.6)"
          >
            {Math.round(tick)} %
          </text>
        </g>
      ))}

      {dates.map((date, index) =>
        index % labelStep === 0 || index === dates.length - 1 ? (
          <text
            key={date}
            x={x(date)}
            y={height - 12}
            textAnchor="middle"
            fontSize={11}
            fill="rgba(255,255,255,0.6)"
          >
            {formatDay(date)}
          </text>
        ) : null,
      )}

      {series.map((s) => {
        const pts = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
        const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date)},${y(p.value)}`).join(" ");
        return (
          <g key={s.name}>
            <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
            {pts.map((p) => (
              <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={3.5} fill={s.color}>
                <title>{`${s.name} — ${formatDay(p.date)}: ${p.value} %`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Barvy pro srovnavaci graf: oranzova je vzdy prvni, zbytek doplnkove tony. */
export const SERIES_COLORS = [
  "#ff4a21",
  "#ffffff",
  "#5aa9e6",
  "#e5b53c",
  "rgba(255,74,33,0.55)",
  "rgba(255,255,255,0.45)",
  "rgba(90,169,230,0.6)",
  "rgba(229,181,60,0.6)",
];
