# Inboxpulse — Gmail Sentiment Analyzer

A Next.js app that scans your Gmail sent folder, identifies contacts you've reached out to, and uses Google Gemini to analyze the sentiment of each conversation.

---

## Tech Stack

- **Next.js 14** (App Router) — framework
- **NextAuth.js** — Google OAuth + session management
- **Gmail API** (via `googleapis`) — read sent emails
- **Google Gemini API** (free tier) — sentiment analysis
- **Tailwind CSS** — styling
- **Vercel** — deployment

---

## Local Setup

### 1. Clone and install dependencies

```bash
git clone <your-repo>
cd gmail-sentiment
npm install
```

### 2. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Library**
4. Search for and enable **Gmail API**
5. Go to **APIs & Services → OAuth consent screen**
   - Choose **External**
   - Fill in app name, support email, developer contact
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Add your email as a **test user** (while in development)
6. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (local dev)
     - `https://your-app.vercel.app/api/auth/callback/google` (production)
7. Copy the **Client ID** and **Client Secret**

### 3. Get a Gemini API key (free)

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in, then click **Get API Key**
3. Click **Create API key in new project**
3. Copy it for your environment variables

### 4. Create environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your values:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=your_random_secret         # generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000         # use your Vercel URL in production
GEMINI_API_KEY=your_gemini_api_key
```

### 5. Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## How It Works

```
User signs in with Google OAuth
        ↓
Gmail API fetches up to 200 sent messages
        ↓
Contacts are extracted and deduplicated
        ↓
User clicks "Analyze" (or "Analyze All")
        ↓
Gmail API fetches full thread content (up to 5 threads per contact)
        ↓
Claude AI analyzes sentiment → positive / negative / neutral / mixed
        ↓
Results shown: summary, tone, topics, score bar
```

---

## Project Structure

```
gmail-sentiment/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # Google OAuth handler
│   │   ├── gmail/route.ts                # Fetches contacts from Gmail
│   │   └── sentiment/route.ts            # Calls Claude for analysis
│   ├── globals.css                       # Design tokens & base styles
│   ├── layout.tsx                        # Root layout + fonts
│   ├── page.tsx                          # Main app page
│   └── providers.tsx                     # NextAuth session provider
├── components/
│   ├── ContactCard.tsx                   # Per-contact card with sentiment
│   ├── SentimentBadge.tsx                # Positive/negative/etc badge
│   └── LoadingSpinner.tsx                # Animated spinner
├── types/
│   └── next-auth.d.ts                    # Session type augmentation
├── .env.example                          # Environment variable template
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Privacy & Security

- The app requests **read-only** Gmail access (`gmail.readonly` scope)
- Access tokens are stored only in the server-side session (never exposed to the client)
- Email content is sent to the Gemini API for analysis but is **not stored** by this app
- No database is used — all state is in-memory per session

---

## Limitations & Notes

- Analyzes up to **200 sent messages** to build the contact list
- Surfaces the top **30 contacts** by recency
- Per contact, fetches up to **5 threads × 4 messages** for analysis
- Email body is truncated to **4,000 characters** before sending to Claude
- While the OAuth app is in "testing" mode on Google Cloud, only added test users can sign in. To open it to anyone, submit for Google verification.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `redirect_uri_mismatch` | Add the exact callback URL to Google OAuth credentials |
| `401 Unauthorized` | Check `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set correctly |
| `403 Gmail API` | Make sure Gmail API is enabled in Google Cloud Console |
| Blank contact list | Ensure your account has sent emails; check browser console for errors |
| Sentiment always fails | Verify `GEMINI_API_KEY` is set correctly in Vercel env vars |
