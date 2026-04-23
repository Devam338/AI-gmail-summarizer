import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { google } from "googleapis";

function decodeBase64(data: string): string {
  try {
    return Buffer.from(
      data.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8");
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTextFromPayload(payload: any): string {
  if (!payload) return "";

  let text = "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    text += decodeBase64(payload.body.data) + "\n";
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = decodeBase64(payload.body.data);
    text += stripHtml(html) + "\n";
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      text += extractTextFromPayload(part) + "\n";
    }
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function safeJsonParse(text: string) {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error("No valid JSON object found in model response");
  }

  const jsonText = cleaned.slice(jsonStart, jsonEnd + 1);
  return JSON.parse(jsonText);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadIds, contactEmail, contactName } = await req.json();

  if (!threadIds || !Array.isArray(threadIds) || threadIds.length === 0) {
    return NextResponse.json({ error: "No thread IDs provided" }, { status: 400 });
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const gmail = google.gmail({ version: "v1", auth });

    const threadsToFetch = threadIds.slice(0, 5);
    let allEmailContent = "";

    for (const threadId of threadsToFetch) {
      try {
        const thread = await gmail.users.threads.get({
          userId: "me",
          id: threadId,
          format: "full",
        });

        const messages = thread.data.messages || [];

        for (const message of messages.slice(0, 6)) {
          const headers = message.payload?.headers || [];
          const from = headers.find((h) => h.name === "From")?.value || "Unknown";
          const to = headers.find((h) => h.name === "To")?.value || "Unknown";
          const date = headers.find((h) => h.name === "Date")?.value || "";
          const subject = headers.find((h) => h.name === "Subject")?.value || "(no subject)";
          const body = extractTextFromPayload(message.payload).slice(0, 1200);

          if (!body.trim()) continue;

          allEmailContent += [
            "--- EMAIL START ---",
            `From: ${from}`,
            `To: ${to}`,
            `Date: ${date}`,
            `Subject: ${subject}`,
            `Body: ${body}`,
            "--- EMAIL END ---",
            "",
          ].join("\n");
        }
      } catch (threadError) {
        console.error(`Failed to fetch thread ${threadId}:`, threadError);
        continue;
      }
    }

    if (!allEmailContent.trim()) {
      return NextResponse.json({
        sentiment: "neutral",
        score: 0.5,
        summary: "No readable email content could be retrieved for analysis.",
        topics: [],
        tone: "unknown",
      });
    }

    const prompt = `
You are analyzing one email relationship.

Contact:
- Name: ${contactName || "Unknown"}
- Email: ${contactEmail || "Unknown"}

Email conversation:
${allEmailContent.slice(0, 12000)}

Return ONLY raw valid JSON.
Do not use markdown.
Do not use code fences.
Do not include explanation text.

Use exactly this schema:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "score": number,
  "summary": string,
  "topics": string[],
  "tone": string
}

Rules:
- "score" must be between 0 and 1
- "summary" must be specific to this contact and these emails
- "topics" should contain 2 to 5 short topics
- "tone" should be a single short word or phrase
`.trim();

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 700,
            temperature: 0.2,
          },
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!geminiRes.ok) {
      console.error("Gemini API error:", geminiData);
      return NextResponse.json(
        { error: "Gemini API request failed" },
        { status: 500 }
      );
    }

    let result;
    try {
      result = safeJsonParse(text);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", text, parseError);

      result = {
        sentiment: "neutral",
        score: 0.5,
        summary: "Could not reliably analyze this conversation.",
        topics: [],
        tone: "unknown",
      };
    }

    const allowedSentiments = new Set(["positive", "negative", "neutral", "mixed"]);
    if (!allowedSentiments.has(result.sentiment)) {
      result.sentiment = "neutral";
    }

    if (typeof result.score !== "number" || Number.isNaN(result.score)) {
      result.score = 0.5;
    }

    result.score = Math.max(0, Math.min(1, result.score));

    if (!Array.isArray(result.topics)) {
      result.topics = [];
    }

    if (typeof result.summary !== "string") {
      result.summary = "No summary available.";
    }

    if (typeof result.tone !== "string") {
      result.tone = "unknown";
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Sentiment analysis error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze sentiment";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
