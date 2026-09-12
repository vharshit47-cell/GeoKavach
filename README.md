# SurakshaSet

India-wide disaster intelligence added to the existing Next.js application. The original habitation, risk, relocation and simulation tools remain available with explicit **Demo Dataset** labels. Existing groundwater files are preserved.

## Run locally

Use Node.js 22 or newer and npm. From the project directory:

```sh
npm install
npm run dev
```

Open http://localhost:3000. Guest weather, alerts, earthquakes, map search and facilities work without API keys when their public providers are reachable. Copy `.env.example` to `.env.local` for accounts and AI, then restart the server. Never commit `.env.local`.

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm run test:providers` performs real outbound provider checks. With a server running, `npm run test:runtime` tests API contracts, validation, guest isolation and multiple Indian regions. Set `TEST_AI_UNCONFIGURED=1` only when Groq is deliberately unconfigured to test bilingual configuration failures and throttling. Live checks report provider outages rather than substituting fixtures.

## Screens and data flow

- `/dashboard`: India map, explicit GPS/manual search, source availability, official alerts, weather, earthquakes, contextual risk indicators, facilities and news.
- `/nearby`: reported disaster news with hazard and geographic controls. News geography is textual; exact radius matching is unavailable.
- `/safe-sites`, `/relocation`: field-evidence relocation workflow with deterministic risk decisions, OSM facility discovery, verified-capacity allocation, and real road-route guidance. OSM facilities remain unverified candidates until field evidence is saved.
- `/demo`, `/demo/safe-sites`, `/demo/relocation`, `/habitations`, `/simulation`: preserved demo planning with 42 habitations and seven sites. Demo capacities are estimates; map connections are not road routes.
- `/signup`, `/login`, `/forgot-password`, `/auth/update-password`, `/profile`, `/settings`: accounts, saved locations, language, appearance and notification preferences.

Client components live in `src/frontend/components`; app routes in `src/app`; normalized provider adapters in `src/backend/providers`; aggregation and risk/AI logic in `src/backend/services`; types and thresholds in `src/shared`. The browser calls same-origin API routes. Groq credentials remain on the server. APIs send private/no-store responses; provider caches exist in server memory.

## Public sources

| Provider | Purpose | Authentication | Server cache |
| --- | --- | --- | --- |
| [NDMA SACHET](https://sachet.ndma.gov.in/) | Official RSS and linked CAP alerts/geometry | None | RSS 2 min; CAP 10 min |
| [Open-Meteo](https://open-meteo.com/en/docs) | Model-derived current weather and forecast | None for public endpoint | 10 min |
| [USGS](https://earthquake.usgs.gov/fdsnws/event/1/) | Observed earthquakes in India and surrounding region | None | 5 min |
| [GDELT DOC](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) | Disaster news, last 3 days | None | 15 min |
| [OpenStreetMap Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) | Hospitals, schools, community buildings and other facility candidates | None | 6 hours |
| [OpenRouteService](https://openrouteservice.org/dev/#/api-docs) / [OSRM](https://project-osrm.org/) | Server-side road geometry, duration and directions for verified relocation assignments | Optional ORS server key; OSRM fallback requires none | Per plan request |
| [geoBoundaries](https://www.geoboundaries.org/) / DataMeet | Historical state/district boundaries and approximate reverse matching | None | 7 days; geocoding 1 day |
| Open-Meteo / GeoNames | Indian city search | None | 1 day |
| Existing groundwater CSV | Historical context near selected point | None | Index once per process; results 1 day |
| [Groq](https://console.groq.com/docs/models) | Contextual AI answers | Server API key | No conversation/result persistence |
| [Supabase](https://supabase.com/docs/guides/auth) | Accounts and private user preferences | Public project key plus user session | No public response cache |

The app refreshes while visible every five minutes. Public provider requests are bounded, coalesced and cached; failures cool down for one minute. Recent cached fallback is marked stale. These process-local controls are an MVP, not distributed rate limiting. Public services have usage policies and changing availability; commercial use may require reviewing their current terms.

SACHET ingestion is bounded to the latest 100 RSS entries and a small set of linked CAP documents. Only alerts with verified active periods become current warnings. This is not exhaustive warning coverage. Missing geometry is not invented. State-only alerts receive reduced risk weight. Check official sources even when the list is empty.

Weather is model-derived, not a local station measurement. USGS events do not predict future earthquakes. News is reported context, not a confirmed emergency. Its displayed timestamp is GDELT first-seen time; event/publication time may differ. News radius controls cannot manufacture precise coordinates. Historical boundaries may omit changed districts; coordinates remain usable. Groundwater contributes zero risk points.

## Relocation routing setup

Add `OPENROUTESERVICE_API_KEY` to `.env.local` for the preferred road-routing provider, then restart the app with `npm run dev`. The key is used only by the server. If it is absent or OpenRouteService fails, the planner attempts the public OSRM routing service and clearly reports provider failure instead of drawing a straight line.

The planner starts from saved workspace habitation and site assessments. OpenStreetMap supplies nearby public-facility candidates only; those candidates cannot be recommended until a field officer records current safety/access evidence and real capacity limits. Verified capacity is the lowest recorded land, water, sanitation, or shelter limit minus baseline occupancy and already committed allocations. Active severe/extreme NDMA SACHET geometry is checked when available; absence of an intersection is not a safety guarantee.

## Supabase setup

1. Create a Supabase project. Put its URL and **publishable key** (or legacy anon key) in `.env.local`. Do not use a service-role key in any `NEXT_PUBLIC_` variable.
2. Run `supabase/migrations/001_initial_schema.sql` in that project's SQL editor. The migration is repeatable and includes RLS, constraints, indexes, triggers and existing-user backfill.
3. Enable email/password authentication. Set Auth Site URL to your app origin; allow `http://localhost:3000/auth/callback` for local development and your production HTTPS callback URL.
4. Keep email confirmation enabled. Test signup confirmation, login, logout and password recovery using actual test accounts. Configure production email delivery in Supabase when needed.
5. For cross-device email confirmation, use the Supabase email-template token-hash callback pattern: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/profile`. For recovery use `type=recovery&next=/auth/update-password`. The callback also handles the default same-browser PKCE code flow.

Tables: `profiles`, `saved_locations`, `notification_preferences`, `alert_history`, `chat_history`. RLS restricts rows to `auth.uid() = user_id` (profiles use `id`). Anonymous database access is revoked. Profile updates have a column allowlist; coordinates can only be stored through explicit saved-location consent. Auth triggers create initial profile/preferences; deleting a user cascades to their rows. Chat history schema requires consent but this app does **not** save chats. Alert history is available in the schema; foreground notification deduplication currently stores bounded alert IDs on the device.

Protected pages validate the session server-side; APIs use verified users and RLS. Cookie refresh uses Next.js `proxy.ts`. Missing credentials leave guest access usable and explain why account controls are unavailable. The optional service-role variable is not used by the MVP.

## Groq AI setup

Set `GROQ_API_KEY` on the server. Default model: `openai/gpt-oss-20b`; use `GROQ_MODEL` to select a model enabled for your account. Review [models](https://console.groq.com/docs/models) and [account limits](https://console.groq.com/docs/rate-limits); the application cannot guarantee a permanent free allowance.

`POST /api/ai/chat` accepts bounded alternating user/assistant messages, `language: en|hi`, an optional validated India location and optional demo habitation ID. It retrieves application context itself: official warnings, weather, earthquakes, news, nearby facilities, historical groundwater and selected demo details. English, Hindi and mixed Hindi/English input are supported by prompt instructions. Source text remains in its original language. The prompt separates source data from instructions and prohibits invented live incidents, shelter capacity, quake predictions and evacuation orders. Responses include source references. AI-generated advice still requires human judgment.

The endpoint has same-origin checks, message/body limits, request throttling, a provider timeout and safe error messages. It returns an explicit bilingual unavailable response without a key. Conversations remain in the current browser session memory. Asking AI sends the conversation and relevant location context to Groq; clearing the chat removes the local conversation.

## Location, notifications and privacy

GPS is requested only after the user clicks Use location once. Denial or timeout leaves manual city/state/district/map selection available. All 36 states and union territories have selector entries. State centers are navigation aids, not user position. Selected coordinates remain in memory unless a signed-in user explicitly saves them with consent.

Language and theme are device preferences. Browser notifications require explicit opt-in and browser permission, and only send serious relevant active official warnings. Alert IDs are deduplicated locally. Notifications work while the page is open; there is no background/push service or saved-location monitoring. Browser support differs, especially on mobile. Emergency 112 opens a confirmation dialog; the telephone link is activated only by the user's final action.

Production must use HTTPS for secure cookies and GPS/notification permissions. Providers receive query coordinates for the requested feature. Configure your hosting access logs to redact location query parameters and authentication callback tokens. Do not log request bodies or keys. `TRUST_PROXY=true` is appropriate only when your trusted ingress overwrites forwarded IP headers; otherwise a shared conservative rate bucket is used.

## Deployment and limitations

A persistent Node server is the straightforward deployment target for this MVP. Keep the groundwater CSV available at `src/backend/data/groundwater/groundwater_master.csv`. Its roughly 148 MB size and process index need to be considered for memory, cold starts and deployment artifact limits. Next output tracing explicitly includes it for relevant routes. No deployment was performed.

Before scaling to multiple instances, use a shared provider cache/rate limiter and move the groundwater index to managed spatial storage while retaining the original files. Confirm live provider licensing, geography and availability for your use case. The triage index is a transparent configurable heuristic, not a calibrated disaster probability. Terrain, river gauges, building vulnerability, live population, verified shelter capacity and road routing are not available; they are not fabricated.

See `IMPLEMENTATION_REPORT.md` for implementation inventory, verification evidence and the remaining account-dependent checks.
# Google Maps (optional)

The live dashboard includes a Google Maps panel synchronized with the selected location, with road and satellite views. The existing interactive hazard map keeps its overlays and location selection. Google Embed cannot display our custom hazard layers or send map clicks back to the app.

1. Create a Google Cloud project, attach a billing account, and enable **Maps Embed API**. [Official setup](https://developers.google.com/maps/documentation/embed/get-api-key).
2. Create a browser API key. Restrict its API access to **Maps Embed API** and its website referrers to `http://localhost:3000/*` and your production website (for example `https://your-domain.com/*`).
3. Add `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=your_key` to `.env.local` and your hosting environment. This key is intentionally browser-visible; restrictions are required.
4. Restart development, or rebuild and redeploy production (Next.js embeds public environment values at build time).
5. On the live dashboard, select a location and click **Show map** in the Google Maps panel. Switch between Satellite and Roads and confirm the selected area is shown. The external Google Maps link works without a key.

[Maps Embed API usage is available at no charge](https://developers.google.com/maps/documentation/embed/usage-and-billing), but Google requires Cloud project/billing setup. This integration does not use the separately priced Maps JavaScript, Places, or Map Tiles APIs. The iframe loads only when opened. If Google shows an authorization error, check API enablement, billing, and referrer restrictions; cross-origin iframe errors cannot be reliably inspected by the app.
