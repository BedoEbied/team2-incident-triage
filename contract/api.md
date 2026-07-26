# FROZEN API CONTRACT — Team 2, AI Incident & Log Triage

**No agent may edit this file or anything else under `contract/`.** If the API disagrees with
this document, the API is wrong. Client-side mismatches are fixed in the client.

- Base URL: `http://localhost:4000/api`
- Backend binds `0.0.0.0` (a physical phone must reach it over LAN — mobile uses the LAN IP, never `localhost`).
- CORS: permissive in dev.
- Auth: `Authorization: Bearer <token>` on every route except `POST /auth/login` and `GET /health`.
- All types come from [`types.ts`](./types.ts). Do not redefine them.
- Errors: `{ "error": { "code": ..., "message": ... } }` with a matching HTTP status.

Seeded demo user: **`oncall@demo.io` / `demo1234`**

---

## Endpoints

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| `GET` | `/health` | — | `{ ok: true }` |
| `POST` | `/auth/login` | `{ email, password }` | `{ token, user }` |
| `GET` | `/auth/me` | — | `User` |
| `POST` | `/uploads` | multipart, field `files` (repeatable) | `{ jobId }` |
| `GET` | `/uploads/:jobId` | — | `UploadJob` |
| `GET` | `/incidents` | see query params below | `IncidentListResponse` |
| `GET` | `/incidents/:id` | — | `IncidentDetail` |
| `PATCH` | `/incidents/:id` | `{ status?, assigneeId?, acknowledged? }` | `Incident` |
| `POST` | `/incidents/:id/notes` | `{ body }` | `Activity` |
| `GET` | `/stats` | — | `Stats` |

### `GET /incidents` query parameters

| param | type | notes |
|---|---|---|
| `q` | string | case-insensitive substring over `title` + `summary` |
| `severity` | string | comma-separated, e.g. `Critical,High` |
| `status` | string | comma-separated, e.g. `New,Investigating` |
| `module` | string | exact match against `module` |
| `from` / `to` | `YYYY-MM-DD` | filters on `lastSeen` |
| `sort` | `severity` \| `occurrences` \| `lastSeen` | default `severity` |
| `order` | `asc` \| `desc` | default `desc` |

### Error codes

| code | HTTP | when |
|---|---|---|
| `UNAUTHORIZED` | 401 | missing/invalid bearer token, bad credentials |
| `NOT_FOUND` | 404 | unknown incident or job id |
| `UNSUPPORTED_LOG_FORMAT` | 400 | uploaded file yielded zero parseable blocks |
| `VALIDATION_ERROR` | 400 | bad status value, malformed body |
| `INTERNAL` | 500 | anything else |

`UNSUPPORTED_LOG_FORMAT` is an explicit PDF requirement — the web client must surface its
`message` inline rather than crashing or showing an empty state.

---

## Mock fixture

[`mock.json`](./mock.json) is generated from the **real** 893-entry corpus, not invented. It holds:

- `user`, `token` — for a mocked login
- `incidents` — 10 incidents, occurrences summing to **893**
- `entriesByIncident` — sample `LogEntry[]` keyed by incident id
- `stats` — a complete `Stats` object

Web and mobile build against this from minute zero and flip a single `API_BASE` constant at
integration. Neither client ever waits for the backend.

Fixture shape check: `bySeverity` = `{Critical:1, High:6, Medium:2, Low:1}`,
`byStatus` = `{New:8, Investigating:1, Resolved:1}`. The dominant incident is the
**661-occurrence** `access_token` Critical.
