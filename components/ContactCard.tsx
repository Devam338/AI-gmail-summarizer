"use client";
 
import { SentimentBadge } from "./SentimentBadge"; 
import { LoadingSpinner } from "./LoadingSpinner";

interface Contact {
  email: string;
  name: string;
  threadIds: string[];
  messageCount: number;
  lastContact: string;
  snippet: string;
} 

interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  score: number;
  summary: string;
  topics: string[];
  tone: string;
}

interface Props {
  contact: Contact;
  sentiment: SentimentResult | "loading" | undefined;
  onAnalyze: () => void;
}

const sentimentColors = {
  positive: "var(--positive)",
  negative: "var(--negative)",
  neutral: "var(--neutral)",
  mixed: "var(--mixed)",
};

const sentimentGlows = {
  positive: "rgba(34,211,165,0.06)",
  negative: "rgba(244,81,90,0.06)",
  neutral: "rgba(160,160,192,0.06)",
  mixed: "rgba(244,162,81,0.06)",
};

function ScoreBar({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(1, score));
  const color =
    clampedScore > 0.65
      ? "var(--positive)"
      : clampedScore < 0.4
      ? "var(--negative)"
      : "var(--mixed)";

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.72rem",
          color: "var(--text-dim)",
          marginBottom: "0.3rem",
        }}
      >
        <span>Negative</span>
        <span>Positive</span>
      </div>
      <div
        style={{
          height: 4,
          background: "var(--border)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${clampedScore * 100}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const avatarColors = [
  ["#6c63ff", "#3d3875"],
  ["#22d3a5", "#0e6b54"],
  ["#f4a251", "#7a5028"],
  ["#f4515a", "#7a282c"],
  ["#51a4f4", "#28527a"],
];

function getAvatarColor(email: string) {
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) % avatarColors.length;
  return avatarColors[hash];
}

export function ContactCard({ contact, sentiment, onAnalyze }: Props) {
  const isLoading = sentiment === "loading";
  const result = typeof sentiment === "object" && sentiment !== null ? sentiment : null;
  const [fg, bg] = getAvatarColor(contact.email);
  const borderColor = result ? sentimentColors[result.sentiment] : "var(--border)";
  const glowColor = result ? sentimentGlows[result.sentiment] : "transparent";

  return (
    <div
      style={{
        background: `linear-gradient(135deg, var(--surface) 0%, ${glowColor} 100%)`,
        border: `1px solid ${borderColor}`,
        borderRadius: "14px",
        padding: "1.5rem",
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${glowColor}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", marginBottom: "1rem" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "10px",
            background: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: fg,
            flexShrink: 0,
            letterSpacing: "0.05em",
          }}
        >
          {getInitials(contact.name || contact.email)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {contact.name || contact.email}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {contact.email}
          </div>
        </div>

        {result && <SentimentBadge sentiment={result.sentiment} />}
      </div>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          fontSize: "0.75rem",
          color: "var(--text-dim)",
          marginBottom: "1rem",
        }}
      >
        <span>🗂 {contact.threadIds.length} thread{contact.threadIds.length !== 1 ? "s" : ""}</span>
        <span>📧 {contact.messageCount} email{contact.messageCount !== 1 ? "s" : ""}</span>
        <span>🕐 {formatDate(contact.lastContact)}</span>
      </div>

      {isLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-dim)", fontSize: "0.85rem" }}>
          <LoadingSpinner size={16} />
          <span>Analyzing…</span>
        </div>
      )}

      {result && (
        <div>
          {result.tone && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.6rem", textTransform: "capitalize" }}>
              Tone: <span style={{ color: sentimentColors[result.sentiment], fontWeight: 600 }}>{result.tone}</span>
            </div>
          )}
          <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
            {result.summary}
          </p>
          {result.topics.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {result.topics.slice(0, 4).map((topic) => (
                <span
                  key={topic}
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.7rem",
                    color: "var(--text-dim)",
                  }}
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
          <ScoreBar score={result.score} />
        </div>
      )}

      {!isLoading && !result && (
        <button
          onClick={onAnalyze}
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            padding: "0.5rem 1.1rem",
            borderRadius: "7px",
            fontSize: "0.8rem",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.borderColor = "var(--accent)";
            (e.target as HTMLButtonElement).style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.target as HTMLButtonElement).style.color = "var(--text)";
          }}
        >
          Analyze sentiment →
        </button>
      )}
    </div>
  );
}
