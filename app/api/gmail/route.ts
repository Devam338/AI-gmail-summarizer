import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { google } from "googleapis";

export interface Contact {
  email: string;
  name: string;
  threadIds: string[];
  messageCount: number;
  lastContact: string;
  snippet: string;
}

function extractEmail(header: string): string {
  const match = header.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : header.toLowerCase().trim();
}

function extractName(header: string): string {
  const match = header.match(/^([^<]+)<[^>]+>/);
  return match ? match[1].trim().replace(/"/g, "") : header;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const gmail = google.gmail({ version: "v1", auth });

    // Get user's email
    const profile = await gmail.users.getProfile({ userId: "me" });
    const userEmail = profile.data.emailAddress?.toLowerCase() || "";

    // Fetch sent messages to find who the user has reached out to
    const sentList = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SENT"],
      maxResults: 200,
    });

    const messages = sentList.data.messages || [];
    const contactMap = new Map<string, Contact>();

    // Process each sent message
    for (const msg of messages.slice(0, 100)) {
      if (!msg.id) continue;

      const message = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["To", "Subject", "Date"],
      });

      const headers = message.data.payload?.headers || [];
      const toHeader = headers.find((h) => h.name === "To")?.value || "";
      const dateHeader = headers.find((h) => h.name === "Date")?.value || "";
      const threadId = message.data.threadId || "";

      // Handle multiple recipients
      const recipients = toHeader.split(",").map((r) => r.trim());

      for (const recipient of recipients) {
        const email = extractEmail(recipient);
        if (!email || email === userEmail || email.includes("noreply") || email.includes("no-reply")) continue;

        const name = extractName(recipient) || email;

        if (contactMap.has(email)) {
          const contact = contactMap.get(email)!;
          if (!contact.threadIds.includes(threadId)) {
            contact.threadIds.push(threadId);
          }
          contact.messageCount++;
          // Keep the most recent date
          if (new Date(dateHeader) > new Date(contact.lastContact)) {
            contact.lastContact = dateHeader;
          }
        } else {
          contactMap.set(email, {
            email,
            name,
            threadIds: [threadId],
            messageCount: 1,
            lastContact: dateHeader,
            snippet: message.data.snippet || "",
          });
        }
      }
    }

    const contacts = Array.from(contactMap.values())
      .sort((a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime())
      .slice(0, 30); // Top 30 contacts

    return NextResponse.json({ contacts, userEmail });
  } catch (error: unknown) {
    console.error("Gmail API error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch Gmail data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
