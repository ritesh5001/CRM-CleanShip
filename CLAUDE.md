# CLAUDE.md — CleanShip CRM

Guidance for working in this repository.

## What this project is

CleanShip CRM is a **telecaller management CRM**. Its purpose is to let a **Superadmin** control and
coordinate telecallers: create their accounts (and set each telecaller's name & daily call target),
assign them leads and tasks, and monitor what they're doing and the call outcomes they report.
**Telecallers** log in, see their assigned leads/tasks/follow-ups, place calls (click-to-call),
record dispositions, and update task status.

## Architecture

Monorepo with two independent packages, orchestrated by the root `package.json`:

- **`server/`** — Express + TypeScript REST API (MongoDB via Mongoose). ESM (`"type"` via NodeNext).
- **`client/`** — React + TypeScript SPA (Vite + Tailwind). Mobile + desktop responsive.

The client dev server proxies `/api` to the API. API base path is `/api/v1`.

### Ports
- API: **5050** (avoid 5000 — macOS AirPlay Receiver uses it).
- Client: **5173**.

## Roles & permissions

Two roles (`superadmin`, `telecaller`):

- **Superadmin:** manage telecallers; create/import/assign leads; create/assign/delete tasks; view
  all data; dashboard analytics. No public signup — superadmin creates telecallers.
- **Telecaller:** sees only their own leads/tasks/follow-ups; logs calls; updates task status;
  marks follow-ups done; personal stats.

Enforced by `authenticate` (JWT) + `requireRole(...)` middleware, plus per-document ownership checks
in controllers (telecaller queries are scoped to `assignedTo === req.user.id`).

## Data models (`server/src/models`)

- **User** — `name, email, phone, passwordHash, role, isActive, dailyTarget, twilioNumber, createdBy,
  lastLoginAt`. `twilioNumber` is the Twilio caller ID the admin assigned this telecaller to dial
  from (''=none). Methods: `setPassword`, `comparePassword` (bcrypt). `passwordHash` is `select:false`.
- **Lead (= Contact)** — the collection stores **all contacts**; `qualified` marks the ones promoted
  to Leads. Fields: `name, phone, altPhone, email, title, company, city, state, country, source, tags,
  status, priority, qualified, callStatus(pending|done|not_done), lastOutcome, remarks[], assignedTo,
  assignedAt, lastContactedAt, nextFollowUpAt, notes, createdBy, importBatch`.
  Statuses: new, assigned, in_progress, interested, callback, not_interested, converted, dnd.
  `remarks[]` is a shared timeline `{ text, by, byName, byRole, createdAt }` both roles append to.
  **Contacts** = all records; **Leads** = `qualified:true` (set when a call outcome is interested/converted).
- **Task** — `title, description, type(call|follow_up|custom), relatedLead, assignedTo, assignedBy,
  dueDate, priority, status(pending|in_progress|completed|cancelled), completedAt`.
- **CallLog** — `lead, telecaller, disposition, notes, durationSec, nextFollowUpAt, phone (which of
  the contact's numbers: phone1|phone2|phone3), phoneNumber (the dialed number), twilioCallSid,
  recordingUrl`. `DISPOSITION_TO_LEAD_STATUS` maps a disposition → resulting lead status.
- **CallRecording** — `callSid, recordingUrl, durationSec, status`. Staging area for async Twilio
  recording/status webhooks, keyed by CallSid; `logCall` attaches it to the CallLog.
- **Integration** — singleton settings doc (`key:'twilio'`): `enabled, accountSid, authToken,
  apiKeySid, apiKeySecret, twimlAppSid, callerId, recordCalls, defaultCountryCode, publicServerUrl`.
  `defaultCountryCode` (e.g. '+91') is prepended to dialled numbers lacking a country code. Managed
  from the admin Integrations panel (secrets never returned raw).
- **FollowUp** — `lead, telecaller, scheduledAt, status(pending|done|missed), notes, callLog`.
- **Notification** — `recipient, type, title, message, link, isRead`.
- **ImportBatch** — `fileName, uploadedBy, totalRows, successCount, errorCount, errors[]`.

## API surface (`/api/v1`)

- **Auth:** `POST /auth/login`, `GET /auth/me`, `PUT /auth/change-password`, `POST /auth/logout`.
- **Users (superadmin):** `GET/POST /users`, `GET/PUT/DELETE /users/:id`,
  `PATCH /users/:id/status|target|twilio-number|reset-password`.
- **Leads/Contacts:** `GET /leads` (use `?qualified=true` for the Leads view, `?callStatus=`, search,
  status filters), `POST /leads`, `GET/PUT/DELETE /leads/:id`, `POST /leads/import`,
  `PATCH /leads/bulk-assign`, `PATCH /leads/:id/assign`, `POST /leads/:id/remarks` (both roles add to
  the shared timeline; telecaller scoped to assigned). Writes/import/assign are superadmin-only;
  telecallers get a scoped `GET`/`PUT`.
- **Tasks:** `GET /tasks`, `POST /tasks` (admin), `GET /tasks/:id`, `PUT /tasks/:id` (admin),
  `PATCH /tasks/:id/status`, `DELETE /tasks/:id` (admin).
- **Calls:** `GET /calls` (call history; `?lead=` for one contact; telecaller scoped to own),
  `POST /calls` — telecaller call update: `callStatus: done|not_done`, optional `disposition`
  (required when done), optional `remark` + `nextFollowUpAt`, optional `twilioCallSid`, and `phone`
  (phone1|phone2|phone3) + `phoneNumber` recording *which* number was dialed (so the remark/log
  attach to the right number, not always phone1). Done → logs a CallLog, maps lead status, appends
  remark, maps the disposition onto that number's per-phone CALL STATUS / LEAD STATUS columns +
  stamps `phoneNOutcome.lastCalledAt` (via `DISPOSITION_TO_PHONE_OUTCOME`), and promotes to a Lead
  (`qualified`) when interested/converted. Not-done → marks that number `not_connected`. The
  **Recents** page (`pages/RecentsPage.tsx`) lists recent calls with a scrubbable audio player.
  Twilio browser calling (optional, see below): `GET /calls/config` ({enabled}),
  `GET /calls/token` (mints a Voice access token), `GET /calls/:id/recording` (auth-proxied
  recording audio stream — telecaller scoped to own calls); public Twilio webhooks
  `POST /calls/voice` (returns Dial TwiML), `POST /calls/recording`, `POST /calls/status` — all
  signature-verified.
- **Follow-ups:** `GET /followups?scope=today|upcoming|overdue|all`, `PATCH /followups/:id/done`.
- **Notifications:** `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`.
- **Reports:** `GET /reports/overview` (admin), `GET /reports/me` (telecaller).
- **Integrations (superadmin):** `GET /integrations/twilio`, `PUT /integrations/twilio` — Twilio
  calling credentials/toggles (secrets masked on read); `GET /integrations/twilio/numbers` — the
  account's voice-capable numbers, for assigning to telecallers.

Response shapes: success → `{ success: true, ... }`; lists → `{ success, data, pagination }`;
errors → `{ success: false, message, details? }` via the central `errorHandler`.

## Server conventions

- Controllers wrap async logic in `asyncHandler` and throw `ApiError.*(...)` for failures.
- Request validation via zod schemas in `validators/` applied with the `validate(schema, source)`
  middleware (replaces `req.body`/merges query).
- Use `idOf(ref)` (`utils/idOf.ts`) when comparing a Mongoose ref that may be populated or raw.
- Notifications are emitted via `services/notificationService.ts` (`notify({...})`).
- Lead import logic lives in `services/importService.ts` (xlsx + header normalization; handles CRM
  and Apollo.io export columns — first/last name, multiple phone columns, apostrophe-cleaning).
- New resource = model → validators → controller → routes → register in `routes/index.ts`.

## Client conventions

- Server state via **TanStack Query** hooks in `src/api/*` (one file per resource). Mutations
  invalidate the relevant query keys.
- Auth/token in **Zustand** (`store/auth.ts`, persisted to localStorage). Axios instance
  (`api/client.ts`) injects the bearer token and logs out on 401.
- Routing in `routes/router.tsx`; guards `ProtectedRoute` / `RoleRoute` in `routes/guards.tsx`.
- Role-aware pages (`pages/*`) branch on `useAuthStore().user.role`; the dashboard renders
  `SuperadminDashboard` or `TelecallerDashboard`.
- Reusable UI in `components/ui/` (Button, Field, Modal, Misc). Feature modals in `features/*`.
- Formatting/click-to-call helpers in `lib/format.ts`; label/color maps in `lib/constants.ts`.
  Country dialling codes/timezones/ISO in `lib/countries.ts`; `<CountryTime>`
  (`components/CountryTime.tsx`) shows a country's live local time (contacts Location cell).
  Phone parsing/formatting in `lib/phone.ts` via **libphonenumber-js**: `formatPhoneDisplay(raw,
  country)` for pretty display (strips junk like leading quotes, formats international), and
  `toE164(raw, country, defaultCode)` for dialling — parses with the contact's country so a number
  that already includes the country code without '+' (e.g. `14102927721`) isn't double-prefixed.
- `@/` is aliased to `client/src/`.

## Commands

```bash
npm run install:all   # install all deps
npm run seed          # seed superadmin + demo data
npm run dev           # API (:5050) + client (:5173)
npm run build         # build both
npm run typecheck     # tsc --noEmit in both packages
```

Seeded logins: `admin@cleanship.com / Admin@12345`, `telecaller@cleanship.com / Tele@12345`.

## Environment (`server/.env`)

`PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN`, and
`SUPERADMIN_NAME/EMAIL/PASSWORD` (seed). Twilio is **not** configured via env (see Telephony); the
only related var is the optional `PUBLIC_SERVER_URL` webhook fallback. See `server/.env.example`.

## Telephony (Twilio browser softphone)

Optional. Twilio is configured at runtime from the **admin panel** (superadmin → Integrations,
`pages/IntegrationsPage.tsx`), persisted to the `Integration` singleton (`key:'twilio'`), **not** env
vars. When `enabled` + all creds are present, clicking **Call** dials the lead from the telecaller's
browser via the **Twilio Voice JS SDK** (`@twilio/voice-sdk`); otherwise Call falls back to plain
`tel:` links. **Per-user caller IDs:** the admin assigns each telecaller a Twilio number on the
Integrations page (`User.twilioNumber`, via `PATCH /users/:id/twilio-number`); a telecaller can only
call if they have one (superadmin falls back to the integration's default `callerId`). `GET
/calls/config` and `/calls/token` are gated by `resolveCallerId(userId)`; the voice webhook derives
the caller from `From` (`client:<userId>`) and dials with that user's number. Flow: client mints a
token (`GET /calls/token`) and creates a `Device` (`client/src/store/call.ts`), connects with the
lead's number → Twilio fetches Dial TwiML from `POST /calls/voice` → audio in the browser
(`features/calls/CallBar.tsx`) → on hangup the
`CallDispositionModal` logs the outcome via the existing `POST /calls` (with `twilioCallSid` +
auto-measured duration). Recording is a panel toggle; when on, Twilio's `POST /calls/recording`
webhook stages the recording in the `CallRecording` collection (keyed by CallSid) which `logCall`
attaches to the CallLog. Playback: recordings are streamed back through `GET /calls/:id/recording`

(server fetches the Twilio media with Basic auth and proxies it — creds never reach the browser);
the client downloads it as a blob and plays it (`features/calls/CallHistory.tsx`, shown in the
expanded contact row). Server bits: `services/twilioService.ts` reads settings from the DB per
request (token/TwiML/signature); webhooks are signature-verified in `routes/callRoutes.ts`; admin
CRUD in `controllers/integrationController.ts` (secrets masked on read — `authToken`/`apiKeySecret`
returned only as `*Set` flags). One-time Twilio-console setup: create an API Key + a TwiML App whose
Voice URL is the panel's shown `voiceWebhookUrl` (`https://<server>/api/v1/calls/voice`); set the
panel's "Public server URL" (or `PUBLIC_SERVER_URL`) so recording webhooks resolve — use ngrok
locally.

## Notes for future work

- Incoming calls aren't handled (the VoiceGrant is `incomingAllow:false`); add browser inbound +
  call transfer behind `twilioService` later if needed.
- `xlsx` has an unpatched npm ReDoS advisory; import is superadmin-only. Consider the SheetJS CDN
  build if hardening is needed.
- Notifications poll every 30s; could move to WebSockets/SSE for realtime.
