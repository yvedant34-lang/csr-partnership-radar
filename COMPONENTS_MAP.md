# Components Map

![CSR Partnership Radar components map](docs/components-map.png)

Source: [docs/components-map.svg](docs/components-map.svg)

| Box | What it is | App part |
|---|---|---|
| 1 Trigger | Vercel Cron daily at 05:00 IST (ingest) and Mondays at 05:30 IST (digest), both guarded by CRON_SECRET; Paste a link for LinkedIn and WhatsApp posts | Backend, Frontend |
| 2 Input | Google News RSS, 9 search lanes, last 7 days; the full publisher article behind each link; pasted post text. Stored in raw_items | API, Database |
| 3 Context | radar_config (sectors, Pune footprint, weights, thresholds, gates); 15 verified live leads and stage history; Lusha contacts under a credit cap; the NGO programme and its 84% retention outcome | Database, API |
| 4 Processing | Keyword prefilter; one lead per company, signal and IST week; score and tier in plain code; conversion estimate and confidence; next actions per lead | Backend |
| 5 AI | Gemini Flash at temperature 0 with a fixed JSON schema: extracts facts and people named, plans the outreach, drafts the email, LinkedIn note and call opener. Steps through Flash models when a daily limit is hit | API |
| 6 Human decision | Ananya decides who to call, edits drafts, sends them from her own Gmail or Outlook, ticks actions, moves stages. Edits need the passcode | Frontend |
| 7 Output | Dashboard, leads table, lead pages, pipeline and conversion chart, tasks with drafts, proven funders, policy; Monday digest by Resend and at /digest/week | Frontend, API |
| Version control | GitHub with a CI check on every push (typecheck, 65 tests, production build) and automatic deploy to Vercel. Keys only in environment variables | Version Control |

What the map leaves out on purpose: nothing is ever sent to a company by the system, LinkedIn is never fetched, and Gemini never sets a score, tier or probability.
