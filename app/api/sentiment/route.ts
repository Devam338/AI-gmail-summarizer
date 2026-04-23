import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { google } from "googleapis";

function decodeBase64(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractTextFromPayload(payload: any): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractTextFromPayload(part);
      if (text) return text;
    }
  }

  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  return "";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadIds, contactEmail, contactName } = await req.json();

  if (!threadIds || threadIds.length === 0) {
    return NextResponse.json({ error: "No thread IDs provided" }, { status: 400 });
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const gmail = google.gmail({ version: "v1", auth });

    // Fetch thread content (limit to first 5 threads to stay within limits)
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
        for (const message of messages.slice(0, 4)) {
          const headers = message.payload?.headers || [];
          const from = headers.find((h) => h.name === "From")?.value || "Unknown";
          const date = headers.find((h) => h.name === "Date")?.value || "";
          const subject = headers.find((h) => h.name === "Subject")?.value || "(no subject)";
          const body = extractTextFromPayload(message.payload);

          allEmailContent += `\n---\nFrom: ${from}\nDate: ${date}\nSubject: ${subject}\nBody: ${body.slice(0, 500)}\n`;
        }
      } catch {
        // Skip threads that can't be fetched
        continue;
      }
    }

    if (!allEmailContent) {
      return NextResponse.json({
        sentiment: "neutral",
        score: 0.5,
        summary: "No email content could be retrieved for analysis.",
        topics: [],
      });
    }

    // Analyze with Gemini
    const prompt = `Analyze the sentiment of this email conversation with ${contactName} (${contactEmail}).

Email thread content:
${allEmailContent.slice(0, 4000)}

Respond with a JSON object (no markdown, just raw JSON) with these fields:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "score": <number from 0 (very negative) to 1 (very positive)>,
  "summary": "<2-3 sentence summary of the relationship and conversation tone>",
  "topics": ["<topic1>", "<topic2>", "<topic3>"],
  "tone": "<one word describing the overall tone, e.g. professional, friendly, tense, enthusiastic>"
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.2 },
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let result;
    try {
      result = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      result = {
        sentiment: "neutral",
        score: 0.5,
        summary: "Could not analyze sentiment for this conversation.",
        topics: [],
        tone: "unknown",
      };
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Sentiment analysis error:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze sentiment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
