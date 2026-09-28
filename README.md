# Workation approval, case study prototype

Coded version of the Figma prototype (page 07 · Screens) for a product design hiring case study.
Concept by Debora Moratalla. Not a WorkFlex product. All data is sample data.

## What the AI does (live, through Vercel AI Gateway)

| Where | Route | What it does |
|---|---|---|
| Decision panel | `POST /api/assess` | Headline, summary, evidence line and sources for the request. Anomalies become banners "Flagged by the agent". |
| Reject, Message, Approve anyway dialogs | `POST /api/draft` | Streams an editable draft. Laura edits before sending. |
| Ask the agent | `POST /api/ask` | Answers a question about this request, citing sources. |

Guardrails:
- Approve is decided by rules in `lib/agent.ts` (`canApprove`, `ruleChecks`), never by the model.
- The model never approves, rejects or cancels. Every AI output is labelled and logged in Activity.
- If the model fails, the panel says so and the rules still work (that is the "agent couldn't" state).

## Run locally

```bash
npm install
cp .env.example .env.local   # add AI_GATEWAY_API_KEY
npm run dev
```

## Deploy on Vercel

1. Push this folder to a GitHub repo and import it in Vercel.
2. AI Gateway: on Vercel the deployment authenticates with OIDC, so no key is needed. Enable AI Gateway for the team if asked.
3. Environment variables: `SITE_PASSWORD` (reviewers log in with any user name and this password), optional `AI_MODEL` (default `anthropic/claude-sonnet-4.5`).
4. Share the URL and the password with reviewers.

## Scenarios

Use the selector in the bottom bar, or ‹ › / J K in the drawer: Ready for decision, Agent working, Agent couldn't verify, Data conflict.

## Tokens

`app/globals.css` mirrors the Figma variables: `01. Core`, `02. Semantic`, `03. Component`.
