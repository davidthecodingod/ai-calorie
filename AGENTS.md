# AI Calorie — notes for agents

A local web app: an Express server (`server/`) serves a built React front end
(`src/` → `dist/`) and holds the AI and lookup calls. User data lives in
`~/.ai-calorie/data.json`. Build with `npm run build`, run with `npm start`.

Nutrition numbers come from three places, and only one of them costs anything:

- **Barcodes** → Open Food Facts (`server/offapi.mjs`). Open data, no key. Free.
- **Nutrition panels** → OCR in the browser (`src/ocr.ts`, `src/labelParse.ts`).
  Nothing is uploaded. Free. Falls back to the AI read when too little is legible.
- **Meal photos and descriptions** → a vision model (`server/ai.mjs`). Paid.

## publik API
- Base URL: https://publikhq.com/api/v1 (OpenAI Chat Completions, Responses, Anthropic Messages)
- Models: publik-fast, publik-balanced, publik-smart only; never a vendor model name
- Key: per-install `pk_` from POST /installs, stored at the publik credential path; env PUBLIK_API_KEY / PUBLIK_API_BASE_URL override
- App token: publik-app-token.txt (public by design, committed) or PUBLIK_APP_TOKEN
- 402: show error.message plus error.top_up_url only
- Never print or log a key
- Docs: https://publikhq.com/llms.txt, https://publikhq.com/developers, https://publikhq.com/skills/api.md
