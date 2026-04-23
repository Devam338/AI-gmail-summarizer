"use client";

interface Props {
  sentiment: "positive" | "negative" | "neutral" | "mixed";
}

const config = {
  positive: { label: "Positive", color: "var(--positive)", bg: "rgba(34,211,165,0.1)", icon: "↑" },
  negative: { label: "Negative", color: "var(--negative)", bg: "rgba(244,81,90,0.1)", icon: "↓" },
  neutral:  { label: "Neutral",  color: "var(--neutral)",  bg: "rgba(160,160,192,0.1)", icon: "—" },
  mixed:    { label: "Mixed",    color: "var(--mixed)",    bg: "rgba(244,162,81,0.1)", icon: "~" },
};

export function SentimentBadge({ sentiment }: Props) {
  const c = config[sentiment];
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.color}40`,
        borderRadius: "6px",
        padding: "0.2rem 0.6rem",
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
      }}
    >
      <span>{c.icon}</span>
      {c.label.toUpperCase()}
    </span>
  );
}
