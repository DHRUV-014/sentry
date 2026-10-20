/** Slow, quiet brand motif for the sign-in panel: a shield outline with a waveform breathing inside.
 *  Pure SVG + CSS transforms; with reduced motion it is a still image. */
export default function BrandMotion({ className = "" }: { className?: string }) {
  const bars = [0.25, 0.45, 0.7, 0.9, 1, 0.8, 0.6, 0.85, 0.55, 0.35, 0.2];
  return (
    <svg viewBox="0 0 560 560" className={className} aria-hidden="true">
      <circle cx="280" cy="280" r="270" fill="none" stroke="rgb(var(--accent) / 0.06)" strokeWidth="1" />
      <circle cx="280" cy="280" r="210" fill="none" stroke="rgb(var(--accent) / 0.08)" strokeWidth="1" />
      <circle cx="280" cy="280" r="150" fill="rgb(var(--accent) / 0.04)" />
      <path
        d="M280 120 175 162v76c0 66 45 115 105 133 60-18 105-67 105-133v-76L280 120Z"
        fill="rgb(var(--surface) / 0.7)"
        stroke="rgb(var(--accent) / 0.35)"
        strokeWidth="1.5"
      />
      <g>
        {bars.map((h, i) => (
          <rect
            key={i}
            x={220 + i * 11}
            y={250 - h * 40}
            width="5"
            height={h * 80}
            rx="2.5"
            fill="rgb(var(--accent) / 0.55)"
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: `wave ${3.2 + (i % 3) * 0.6}s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </g>
    </svg>
  );
}
