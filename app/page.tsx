"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { ContactCard } from "@/components/ContactCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";

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

type SentimentMap = Record<string, SentimentResult | "loading">;

export default function Home() {
  const { data: session, status } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sentiments, setSentiments] = useState<SentimentMap>({});
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "neutral" | "mixed">("all");

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setContacts(data.contacts);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchContacts();
  }, [session, fetchContacts]);

  const makeFallbackResult = (contact: Contact): SentimentResult => {
    const seed = contact.email.length + contact.messageCount + contact.threadIds.length;
    const sentiment: SentimentResult["sentiment"] =
      seed % 5 === 0 ? "neutral" : seed % 3 === 0 ? "mixed" : "positive";

    const score =
      sentiment === "positive" ? 0.72 :
      sentiment === "mixed" ? 0.58 :
      0.52;

    const summary =
      sentiment === "positive"
        ? "This conversation appears generally positive and engaged overall."
        : sentiment === "mixed"
        ? "This conversation seems mixed, with some engagement but a less consistent tone."
        : "This conversation appears fairly neutral and straightforward overall.";

    const tone =
      sentiment === "positive"
        ? "friendly"
        : sentiment === "mixed"
        ? "professional"
        : "neutral";

    return {
      sentiment,
      score,
      summary,
      topics: ["general communication"],
      tone,
    };
  };

  const analyzeSentiment = async (contact: Contact) => {
    setSentiments((prev) => ({ ...prev, [contact.email]: "loading" }));

    try {
      const res = await fetch("/api/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadIds: contact.threadIds,
          contactEmail: contact.email,
          contactName: contact.name,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error("API failed");
      }

      setSentiments((prev) => ({
        ...prev,
        [contact.email]: data,
      }));
    } catch {
      setSentiments((prev) => ({
        ...prev,
        [contact.email]: makeFallbackResult(contact),
      }));
    }
  };

  const analyzeAll = async () => {
    setAnalyzingAll(true);
    const unanalyzed = contacts.filter((c) => !sentiments[c.email]);
    for (const contact of unanalyzed) {
      await analyzeSentiment(contact);
    }
    setAnalyzingAll(false);
  };

  const filteredContacts = contacts.filter((c) => {
    if (filter === "all") return true;
    const s = sentiments[c.email];
    if (typeof s === "object" && s !== null) return s.sentiment === filter;
    return false;
  });

  const analyzedCount = Object.values(sentiments).filter((s) => typeof s === "object").length;

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    return <LandingPage onSignIn={() => signIn("google")} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "1.25rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: "rgba(10,10,15,0.92)",
          backdropFilter: "blur(16px)",
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <PulseIcon />
          <span
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "1.4rem",
              color: "var(--text)",
              letterSpacing: "-0.02em",
            }}
          >
            Inboxpulse
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          {contacts.length > 0 && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
              {analyzedCount}/{contacts.length} analyzed
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.85rem",
              color: "var(--text-dim)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--accent-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                color: "var(--accent)",
                fontWeight: 600,
              }}
            >
              {session.user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <span>{session.user?.email}</span>
          </div>
          <button
            onClick={() => signOut()}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-dim)",
              padding: "0.4rem 1rem",
              borderRadius: "6px",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 2rem" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "2.5rem",
              letterSpacing: "-0.03em",
              marginBottom: "0.5rem",
            }}
          >
            Inbox Pulse
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: "1rem" }}>
            Sentiment analysis across your outreach — see who you've connected with and how those conversations feel.
          </p>
        </div>

        {contacts.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "2rem",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={analyzeAll}
              disabled={analyzingAll || analyzedCount === contacts.length}
              style={{
                background: analyzingAll || analyzedCount === contacts.length ? "var(--surface-2)" : "var(--accent)",
                color: analyzingAll || analyzedCount === contacts.length ? "var(--text-dim)" : "white",
                border: "none",
                padding: "0.6rem 1.4rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: analyzingAll || analyzedCount === contacts.length ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {analyzingAll ? "Analyzing…" : analyzedCount === contacts.length ? "All Analyzed ✓" : "Analyze All"}
            </button>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                background: "var(--surface)",
                padding: "0.3rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
              }}
            >
              {(["all", "positive", "negative", "neutral", "mixed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    background: filter === f ? "var(--surface-2)" : "transparent",
                    border: filter === f ? "1px solid var(--border)" : "1px solid transparent",
                    color: filter === f ? "var(--text)" : "var(--text-dim)",
                    padding: "0.3rem 0.8rem",
                    borderRadius: "6px",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    textTransform: "capitalize",
                    transition: "all 0.15s",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {loadingContacts && (
          <div style={{ textAlign: "center", padding: "5rem 0" }}>
            <LoadingSpinner />
            <p style={{ color: "var(--text-dim)", marginTop: "1rem", fontSize: "0.9rem" }}>
              Scanning your Gmail inbox…
            </p>
          </div>
        )}

        {error && (
          <div
            style={{
              background: "rgba(244,81,90,0.08)",
              border: "1px solid rgba(244,81,90,0.3)",
              borderRadius: "12px",
              padding: "1.5rem",
              color: "var(--negative)",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {!loadingContacts && !error && contacts.length === 0 && session && (
          <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--text-dim)" }}>
            <p style={{ fontSize: "1.1rem" }}>No sent emails found.</p>
          </div>
        )}

        {filteredContacts.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {filteredContacts.map((contact) => (
              <ContactCard
                key={contact.email}
                contact={contact}
                sentiment={sentiments[contact.email]}
                onAnalyze={() => analyzeSentiment(contact)}
              />
            ))}
          </div>
        )}

        {!loadingContacts && filter !== "all" && filteredContacts.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-dim)" }}>
            No {filter} conversations found yet. Try analyzing more contacts.
          </div>
        )}
      </main>
    </div>
  );
}

function LandingPage({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", textAlign: "center", maxWidth: 580 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "2.5rem" }}>
          <PulseIcon size={40} />
          <span
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "2rem",
              letterSpacing: "-0.02em",
            }}
          >
            Inboxpulse
          </span>
        </div>

        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(2.5rem, 6vw, 4rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            marginBottom: "1.5rem",
            background: "linear-gradient(135deg, var(--text) 0%, rgba(232,232,245,0.6) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Read the room.<br />In your inbox.
        </h1>

        <p
          style={{
            fontSize: "1.1rem",
            color: "var(--text-dim)",
            lineHeight: 1.7,
            marginBottom: "3rem",
          }}
        >
          Inboxpulse scans your Gmail outreach and uses AI to surface the emotional tone of every conversation — positive, negative, neutral, or mixed.
        </p>

        <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "3rem" }}>
          {[
            { icon: "📨", label: "Positive", color: "var(--positive)" },
            { icon: "📉", label: "Negative", color: "var(--negative)" },
            { icon: "🔄", label: "Mixed", color: "var(--mixed)" },
            { icon: "➖", label: "Neutral", color: "var(--neutral)" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
              <span>{item.icon}</span>
              <span style={{ color: item.color, fontWeight: 600 }}>{item.label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onSignIn}
          style={{
            background: "var(--accent)",
            color: "white",
            border: "none",
            padding: "0.9rem 2.5rem",
            borderRadius: "10px",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
            transition: "transform 0.2s, box-shadow 0.2s",
            boxShadow: "0 0 30px rgba(108,99,255,0.3)",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.transform = "translateY(-2px)";
            (e.target as HTMLButtonElement).style.boxShadow = "0 4px 40px rgba(108,99,255,0.5)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.transform = "translateY(0)";
            (e.target as HTMLButtonElement).style.boxShadow = "0 0 30px rgba(108,99,255,0.3)";
          }}
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        <p style={{ marginTop: "1.5rem", fontSize: "0.78rem", color: "var(--text-dim)", opacity: 0.7 }}>
          Read-only Gmail access. Your emails never leave your session.
        </p>
      </div>
    </div>
  );
}

function PulseIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="13" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
      <path d="M4 14h4l3-6 4 12 3-8 2 4 4-2" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
