# Staying up with 5,000 people at once: costs, load tests, go-live checklist

## Why most of the app can't fall over

Shred is local-first. Logging food, diet plans, check-ins, the weight graph and training all run on the phone, so they keep working with no server at all (even offline). Only four things touch a server:

| Part | What it serves | Behaviour under load |
|---|---|---|
| App files (CDN) | The app shell, opened by every phone | A CDN serves thousands of opens a second; files are cached on the phone after the first visit |
| Supabase | Sign-in, sync every 5 minutes, coach dashboard | 5,000 phones is about 15–20 small requests a second; sync quietly retries later if it fails |
| Photo server (`tools/food-vision-server.mjs`) | Photo recognition and the AI fallback for typed meals | Queues AI calls, retries rate limits, says "busy" instead of crashing; the app then offers voice and search |
| Push job (GitHub Actions) | Two runs a day | Not load-sensitive |

The real limit is the AI provider's rate limit (requests per minute), not our code.

## What the photo server does to stay up and cheap

- **Ask once, ask again only when unsure.** `samples: "auto"`: one AI call. Two more only if a dish has confidence under 0.75, a runner-up, or "other". In practice mode that averaged about 1.5 calls per photo, against 3 before.
- **Cache-friendly prompt.** The rules and the 200-dish list come first and never change, so Gemini and OpenAI bill repeated input at the cached rate, and Claude is told to cache it. The photo and the client's note come last.
- **Thinking turned down** for Gemini (`GEMINI_THINKING=low`). Naming dishes doesn't need long reasoning, and thinking tokens are billed as output.
- **Retries:** 429, 5xx and timeouts are retried with backoff (honouring Retry-After), then sent to `GEMINI_FALLBACK_MODEL` (Flash-Lite).
- **Queue:** at most `AI_CONCURRENCY` AI calls at once (default 16; raise it to match your Gemini tier). Beyond `MAX_QUEUE` waiting photos the server answers 503 + Retry-After. The app waits once, retries once, then says "Lots of people are snapping right now" and offers voice and search.
- **`GET /health`:** queue, calls, tokens (including cached tokens) and an estimated cost per photo. Point an uptime monitor at it.
- **Practice mode:** `FOOD_AI=mock` gives instant made-up answers with no key and no cost, for load tests and development.

## Load test results (practice mode, Nov 2026)

The tests ran on one small server process. Each AI call waited 3 s (±30%) to mimic Gemini's real response time, with `AI_CONCURRENCY=400`. Run with `tools/loadtest.mjs`.

| Scenario | Photos | Errors | Typical wait | Slowest 5% |
|---|---|---|---|---|
| 500 people, a photo every ~20 s | 775 | 0 | 3.6 s | 7.3 s |
| 5,000 people all snapping within the same minute | 5,000 | 0 | 3.7 s | 18 s |
| 5,000 people snapping every ~45 s for 4 minutes (extreme: almost 20,000 photos) | 19,945 | 0 | 16 s | 32 s |

What this shows:
- **The server did not crash or drop a request**, even at 20× a realistic load. Memory stayed flat.
- **Waits grow only when demand exceeds the AI calls allowed at once** (the queue doing its job).
- **To keep waits near 4 s at a lunch rush of 5,000 people**, the AI account needs roughly 400–600 calls in flight. That's about 8,000–12,000 requests per minute on Gemini. Check your tier's limits in Google AI Studio, and ask Google for an increase before a viral launch. Below that, people just wait longer; nothing breaks.
- **The cost estimate in practice mode is not real.** Use `/health` on the real server with your actual prices (`PRICE_IN`, `PRICE_CACHED`, `PRICE_OUT`).

## Running the tests

No staging setup needed, on any computer:
```bash
FOOD_AI=mock MOCK_MS=3000 AI_CONCURRENCY=400 MAX_QUEUE=2000 node tools/food-vision-server.mjs
node tools/loadtest.mjs photo --url http://localhost:8787/food-vision --users 5000 --ramp 60 --duration 240 --think 600
```

Against staging, with [k6](https://k6.io) (free). Never test against the live project:
1. Create a **second** Supabase project (staging) and run `supabase/schema.sql` there.
2. Deploy the photo server to staging with `FOOD_AI=mock`, and the app to a staging URL.
3. Run the three scenarios:
   - App opening, 5,000 people in 30 seconds: `k6 run -e URL=https://staging.example.com/ -e USERS=5000 tests/load/static.k6.js`
   - Sync from every phone:
     - make the test users: `node tools/load-users.mjs 5000 > tests/load/tokens.json`
     - run the test: `k6 run -e URL=https://staging.supabase.co -e ANON=… tests/load/sync.k6.js`
   - Photos: `k6 run -e URL=https://photo-staging.example.com/food-vision -e USERS=5000 tests/load/photo.k6.js`
4. Pass marks (built into the scripts):
   - under 1% errors
   - 95% of app opens under 2 s
   - 95% of syncs under 1.5 s
   - 95% of photos under 20 s
5. Then a **small real-AI test**: 50–200 photos with the real key, to measure Google's actual speed and your rate limit, and the real cost per photo from `/health`.
6. Check a cheap Android phone on a slow connection: it should open in a few seconds and logging should feel instant.

## Go-live checklist

- [ ] **App on a CDN.** Cloudflare Pages works well: it's free and serves unlimited static traffic. The `_headers` file sets long caching for the models and libraries. GitHub Pages has a soft limit of about 100 GB a month, which a viral week could pass, because the pose-tracking model is part of the first download.
- [ ] **Supabase on the Pro plan** ($25/month): no pausing, daily backups. Raise the database size if the sync test's p95 goes over 1.5 s.
- [ ] **Photo server:** 2 small always-on instances with auto-scaling (Cloud Run, Fly.io, Render or similar), and `/health` monitored.
- [ ] **A paid Gemini key** with enough requests per minute. `GEMINI_FALLBACK_MODEL` stays on.
- [ ] **Error monitoring** (e.g. Sentry) on the app and the server.
- [ ] **Push notification setup** (supabase/README.md, step 6).

## Monthly cost (estimates, Nov 2026 prices; check before launch)

Assumptions:
- 2 photos per client per day.
- Gemini Flash at $1.50 per million tokens in and $7.50 out (the rates Google lists from 1 Jan 2027).
- About 1.5 AI calls per photo, with cached prompt input.

| | ~500 clients | ~5,000 active clients |
|---|---|---|
| Photo AI | ~$100–150 | ~$1,000–1,500 |
| Supabase | $25–35 | $60–150 |
| Photo server hosting | $10–20 | $30–80 |
| App on CDN, push notifications | $0 | $0–20 |
| Error monitoring | $0 | ~$26 |
| App stores (Apple $99/yr, Google $25 once) | ~$8 | ~$8 |
| **Total** | **~$150–220** | **~$1,150–1,800** |

The real cost per photo shows on `/health` after a day of real use. Set `PRICE_*` to your plan's prices.
