# Ask AI — Design Spec

- **Status:** Approved (brainstorm complete; awaiting plan)
- **Date:** 2026-04-20
- **Branch:** `dev`
- **Author:** Claude (with Ivan)

## 1. Overview

Add an "Ask AI" tab to the ROI Dashboard React SPA that lets internal users ask
natural-language questions about their affiliate performance data and get
streamed answers grounded in the `performance_records` Supabase table. Powered
by an OpenAI tool-calling agent (`gpt-4o-mini`) running in a Vercel Serverless
Function. No vector RAG — the data is structured, so the agent invokes typed
SQL-aggregation tools.

## 2. Goals

1. Single-question answers that complete in <10s for typical questions.
2. Streamed status + token output so users never wait silently for >2s.
3. Defense-in-depth on any ad-hoc SQL escape hatch (parser + read-only role +
   `SECURITY DEFINER` function with `statement_timeout`).
4. Every request logged with token counts, tools used, duration, errors.
5. Per-session rate limit (30/hr) and a global cap (200/hr) to bound cost.
6. Off-topic questions rejected by a cheap classifier before agent tokens spend.
7. Aggregations done in Postgres, not JS.
8. Pluggable shape — adding a `search_documents` vector tool later requires no
   surgery on the agent loop.

## 3. Non-goals (this build)

- Authentication / sign-in (deferred — see §15 phase 1).
- Persisted conversation history; "save" / star answers (deferred — phase 1).
- Vector embeddings, `pgvector`, or any unstructured-data tooling.
- Multi-table schema work — design assumes one core table.
- Inline chart rendering of agent answers (markdown text + tables only).
- Replacing or modifying the deprecated Streamlit `app.py`.
- Prompt template / saved-prompt UI.

## 4. Context (what exists today)

- **Frontend:** React 19 + Vite + TypeScript SPA in `frontend/`, deployed to
  Vercel as a static site. Talks to Supabase from the browser using the anon
  key.
- **Backend:** None. There is no API server today. Vercel only builds the SPA.
- **Auth:** None. Anon key with permissive RLS (`USING (true)` on
  `performance_records`).
- **Streamlit `app.py`:** Untouched since the initial commit; effectively
  deprecated. Out of scope for this work.
- **Core table:** `performance_records` — single denormalised affiliate-perf
  table (see `supabase-setup.sql`). Indexes on `affiliate_id`, `brand`,
  `country`, `date`.
- **Scale assumption:** ~100 uploads/month × ~50K rows; total dataset reaching
  1M+ rows. Aggregation must happen in Postgres, not Node.

## 5. Phase scope

### Phase 0 — this build

- New `Ask AI` sidebar tab in the React SPA.
- New `/api/ask` Vercel Serverless Function (Node 20, streaming SSE).
- Anonymous browser session UUID in localStorage as the identity / rate-limit
  key.
- In-memory chat thread (no persistence between page reloads).
- Six typed tools (§9) including the safe-SQL escape hatch.
- `ask_ai_logs` table for analytics and rate-limiting.
- Dedicated read-only Postgres role `ask_ai_readonly` for tool queries.

### Phase 1 — deferred (triggered by adding Supabase Auth)

Bundled to land together because they all depend on real `auth.uid()`:

1. Supabase Auth (email magic link or OAuth) added to the SPA.
2. Persisted conversation history + "save / star answer" feature
   (`ask_ai_conversations` and `ask_ai_messages` tables, left-rail UI).
3. Migrate `ask_ai_logs.session_id` from localStorage UUID to `auth.uid()`.
4. Tighten existing wide-open `performance_records` RLS policies.

The phase-0 streaming `done` event is shaped so phase-1 history can persist it
verbatim — no contract change needed.

## 6. Architecture

### Topology

```
React SPA (frontend/)                         <-- new Ask AI tab
        │
        │ POST /api/ask  (text/event-stream)
        │ x-session-id: <uuid>
        ▼
Vercel Serverless Function: api/ask.ts        <-- Node 20, streaming
  1. Rate-limit check (SELECT count from ask_ai_logs)
  2. Relevance guard  (gpt-4o-mini classifier)
  3. Agent loop       (gpt-4o-mini + tools, max 5 iterations)
  4. Log to ask_ai_logs
        │
        ├── service-role supabase-js   ──► ask_ai_logs writes
        └── ask_ai_readonly pg pool    ──► tool queries on performance_records
        │
        ▼
Supabase Postgres
  performance_records       (existing, read-only role can SELECT)
  ask_ai_logs               (new, service role writes)
  ask_query()               (new SECURITY DEFINER fn for run_safe_sql)
  Roles:
    anon              unchanged (browser SPA usage)
    ask_ai_readonly   NEW — SELECT only on performance_records,
                      statement_timeout = '5s'
```

### Repo layout

```
api/                                  ← NEW: Vercel functions root
  ask.ts                              ← the streaming endpoint
  _lib/                               ← shared, not routed
    agent.ts                          ← agent loop
    tools/
      get_kpi_summary.ts
      get_top_n.ts
      get_time_series.ts
      compare_periods.ts
      get_funnel.ts
      run_safe_sql.ts
      index.ts                        ← tool registry + status-message map
    safety/
      relevanceGuard.ts
      sqlValidator.ts                 ← node-sql-parser wrapper
    db/
      readOnlyClient.ts               ← pg client w/ ask_ai_readonly
      logsClient.ts                   ← supabase-js w/ service role
    rateLimit.ts
    sseEncoder.ts
    types.ts                          ← shared with frontend via path alias
frontend/
  src/
    pages/AskAI.tsx
    components/AskAI/
      MessageThread.tsx
      UserMessage.tsx
      AssistantMessage.tsx
      StatusLine.tsx
      AskInput.tsx
      ErrorBanner.tsx
    hooks/useAskStream.ts
db/
  migrations/
    YYYYMMDD_ask_ai_logs.sql
    YYYYMMDD_ask_ai_role.sql
    YYYYMMDD_ask_query_function.sql
docs/
  specs/  2026-04-20-ask-ai-design.md
  plans/  YYYY-MM-DD-ask-ai-plan.md
```

`vercel.json` gains a `functions` block so the Vite SPA build coexists with the
Node function:

```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install && npm install --prefix ../api",
  "framework": "vite",
  "functions": { "api/**/*.ts": { "runtime": "@vercel/node@5.x" } }
}
```

(Final `installCommand` form to be confirmed in the implementation plan once
the `api/` package layout is settled — could be a workspaces setup instead.)

## 7. Request → response sequence

```
Browser                       /api/ask                 Postgres / OpenAI
   │ POST {question, history} │                              │
   │ x-session-id: uuid       │                              │
   │─────────────────────────▶│                              │
   │                          │ rate-limit check ───────────▶│ (count in ask_ai_logs)
   │                          │◀─────────────────────────────│
   │                          │  if over limit:              │
   │ ◀── error RATE_LIMITED ──│   close stream, log, return  │
   │                          │                              │
   │                          │ relevance guard ────────────▶│ (gpt-4o-mini classify)
   │                          │◀─────────────────────────────│
   │                          │  if off-topic:               │
   │ ◀── error OFF_TOPIC ─────│   close stream, log, return  │
   │                          │                              │
   │ ◀── status "Analyzing…" ─│                              │
   │                          │ agent.loop() ───────────────▶│ (gpt-4o-mini + tools)
   │                          │   tool call: get_kpi_summary │
   │ ◀── status "Crunching…" ─│                              │
   │                          │   tool result (≤10KB)        │
   │                          │   model emits final tokens   │
   │ ◀── token "Revenue …"  ──│                              │
   │ ◀── token "in Brazil…" ──│                              │
   │ ◀── done {answer,...} ───│                              │
   │                          │ INSERT ask_ai_logs ─────────▶│
```

## 8. API contract

### Request

```
POST /api/ask
Content-Type: application/json
Accept: text/event-stream
x-session-id: <uuid v4>

{
  "question": "Top 5 affiliates by profit in Q1?",
  "history":  [{ "role": "user" | "assistant", "text": "..." }, ...]
}
```

`history` is the in-memory thread so the model has conversational context. The
client may send the full thread; the server trims to the last 6 turns (3 user
+ 3 assistant) before forwarding to the model — see §10. No history persisted
server-side in phase 0.

### SSE events

| Event   | When                                          | Payload                                                                                                                                                                              |
| ------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `status` | Before relevance guard, agent start, each tool | `{ message: string }` — friendly copy only, never tool names                                                                                                                          |
| `token`  | Each delta of the final answer text            | `{ delta: string }`                                                                                                                                                                  |
| `done`   | Answer complete                                | `{ answer: string, tools_used: string[], prompt_tokens: number, completion_tokens: number, total_tokens: number, duration_ms: number, log_id: string }`                              |
| `error`  | Any unrecoverable failure                      | `{ code: ErrorCode, message: string }` — `message` is user-safe                                                                                                                       |

### Error codes

| Code            | Trigger                                            | UI affordance                                                                                                                                                              |
| --------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RATE_LIMITED`  | Per-session 30/hr or global 200/hr cap hit         | "You've hit your hourly limit. Try again at HH:MM." with cooldown timer.                                                                                                   |
| `OFF_TOPIC`     | Relevance guard rejected before agent ran          | Soft yellow banner: "I can only answer questions about your affiliate performance data. Try asking about revenue, ROI, top affiliates, etc."                              |
| `ITERATION_CAP` | Agent loop hit 5 iterations without final answer   | "I couldn't fully answer that in the available steps. Try narrowing the question (e.g. add a date range or a specific brand)." Surfaces partial answer if any tokens streamed. |
| `TOKEN_BUDGET`  | Cumulative tokens reached 8 000                    | Same UI as `ITERATION_CAP`.                                                                                                                                                |
| `TOOL_FAILED`   | A tool threw / returned malformed data             | "Something went wrong. Please try again." Full error logged, never shown.                                                                                                  |
| `MODEL_FAILED`  | OpenAI API error / timeout                         | Same as `TOOL_FAILED`.                                                                                                                                                     |
| `SQL_REJECTED`  | `run_safe_sql` blocked by parser/role/function     | Silent to user; agent told "that query was rejected, try another approach" and loop continues. Only escalates to `ITERATION_CAP` if the model can't recover.               |

## 9. Tools

All tools share two return-side rules: aggregate in SQL, never return more than
~10 KB to the model. The agent loop enforces a hard truncation if a tool
exceeds it.

### Shared types

```ts
type Dim = 'affiliate_id' | 'affiliate_name' | 'country' | 'campaign'
         | 'brand' | 'am' | 'source';

type Metric = 'revenue' | 'cost' | 'profit' | 'roi' | 'ftds' | 'clicks'
            | 'registrations' | 'cpa' | 'conversion_rate'
            | 'casino_real_ngr' | 'sb_real_ngr' | 'flats_and_adjustments';

type Filters = {
  affiliate_id?:   string | string[];
  affiliate_name?: string | string[];
  country?:        string | string[];
  campaign?:       string | string[];
  brand?:          string | string[];
  am?:             string | string[];
  source?:         string | string[];
  period?:         string | string[];
  date_from?:      string;   // 'YYYY-MM-DD'
  date_to?:        string;   // 'YYYY-MM-DD'
};
```

Computed metrics are derived in SQL:
- `profit = SUM(revenue) - SUM(cost)`
- `roi = (SUM(revenue) - SUM(cost)) / NULLIF(SUM(cost), 0)`
- `cpa = SUM(cost) / NULLIF(SUM(ftds), 0)`
- `conversion_rate = SUM(ftds) / NULLIF(SUM(clicks), 0)`

### 1. `get_kpi_summary`

```ts
args:   { filters: Filters, group_by?: Dim[] }
return: { rows: Array<{ ...group_by_keys, revenue, cost, profit, roi,
                        ftds, clicks, registrations, cpa, conversion_rate }> }
```

When `group_by` is empty, returns a single-row totals object.

### 2. `get_top_n`

```ts
args:   { dimension: Dim, metric: Metric, filters: Filters,
          limit: number /* ≤ 50 */, order: 'desc' | 'asc' }
return: { rows: Array<{ [dimension]: string, [metric]: number,
                        ...secondary_metrics }> }
```

### 3. `get_time_series`

```ts
args:   { metric: Metric, granularity: 'day' | 'week' | 'month',
          filters: Filters, max_points?: number /* ≤ 180, default 90 */ }
return: { series: Array<{ bucket: 'YYYY-MM-DD', value: number }> }
```

If the resulting series exceeds `max_points`, the tool widens the granularity
or returns `truncated: true` and trims to the most recent N buckets.

### 4. `compare_periods`

```ts
args:   { filters: Filters,
          period_a: { from: string, to: string },
          period_b: { from: string, to: string },
          metrics: Metric[] }
return: { a: Record<Metric, number>, b: Record<Metric, number>,
          delta_abs: Record<Metric, number>,
          delta_pct: Record<Metric, number> }
```

### 5. `get_funnel`

```ts
args:   { filters: Filters, group_by?: Dim }
return: { rows: Array<{ [group_by?]: string, clicks, registrations, ftds,
                        click_to_reg_pct, reg_to_ftd_pct, click_to_ftd_pct }> }
```

### 6. `run_safe_sql`

```ts
args:   { query: string,    // single SELECT only
          reason: string }  // model explains why it needs ad-hoc SQL
return: { columns: string[], rows: Row[],
          row_count: number, truncated: boolean }
```

See §11 for the three safety layers.

## 10. Agent loop

| Limit                                              | Value | Enforced where                                                |
| -------------------------------------------------- | ----- | ------------------------------------------------------------- |
| Max iterations                                     | 5     | Loop counter                                                  |
| Max total tokens (prompt + completion across turns) | 8 000 | Sum of `usage` field in each OpenAI response                  |
| Max tool result bytes sent to model                | 10 240 | Truncate + append `…[truncated]` notice                       |
| Max tools per turn                                 | 3     | OpenAI `tool_choice` config                                   |
| Per-tool DB statement timeout                      | 5 s   | Set on `ask_ai_readonly` role                                  |
| Total request wall-clock                           | 50 s  | Soft cap before Vercel's 60 s function kill                    |
| History turns sent in `messages`                   | 6     | Last 6 turns (3 user + 3 assistant) — older turns dropped     |

Hitting any limit → emit `error` with the matching code, log the partial run,
close the stream.

### System prompt skeleton (final wording lands during implementation)

```
You are an analyst for an affiliate-marketing dashboard.
You have access to a single dataset: performance_records.

Schema:
  affiliate_id, affiliate_name, country, campaign, brand, am, source,
  period, date, clicks, registrations, ftds, revenue, cost,
  casino_real_ngr, sb_real_ngr, flats_and_adjustments

Business glossary:
  profit          = revenue - cost
  ROI             = profit / cost
  CPA             = cost / ftds
  conversion_rate = ftds / clicks

Rules:
- Use the provided tools to get data. Never invent numbers.
- Aggregate inside tools, not in your head.
- If a question can't be answered with the available data, say so clearly.
- NEVER mention tool names, SQL, column names, or internals to the user.
- Format money as $X,XXX, percentages as XX.X%, dates as Mon DD YYYY.
- Keep answers concise. Use markdown tables for >3 rows of comparisons.
```

## 11. SQL safety — defense in depth (`run_safe_sql` only)

Three independent layers, each sufficient on its own.

### Layer 1 — Node-side parse with `node-sql-parser` (PostgreSQL dialect)

- Reject if `ast.type !== 'select'`.
- Reject if multiple statements (semicolons after parsing).
- Reject any `INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|COPY`
  token surviving an AST walk.
- Reject any reference to `pg_*`, `information_schema`, `auth.*`, `storage.*`,
  `ask_ai_logs`, or any table not in the allowlist (`performance_records`).
- Auto-inject `LIMIT 500` if absent or if `LIMIT > 500`.

### Layer 2 — Dedicated Postgres role `ask_ai_readonly`

```sql
CREATE ROLE ask_ai_readonly LOGIN PASSWORD '<from secret>';
GRANT CONNECT ON DATABASE postgres TO ask_ai_readonly;
GRANT USAGE   ON SCHEMA public     TO ask_ai_readonly;
GRANT SELECT  ON public.performance_records TO ask_ai_readonly;
ALTER ROLE ask_ai_readonly SET statement_timeout = '5s';
ALTER ROLE ask_ai_readonly SET idle_in_transaction_session_timeout = '5s';
```

No grants on any other table, function, or schema. The connection string for
this role lives in the Vercel env var `ASK_AI_READONLY_DATABASE_URL`.

### Layer 3 — `SECURITY DEFINER` function `ask_query(sql text)`

Owned by `ask_ai_readonly`, executes the validated SQL inside a wrapping
subquery that enforces the final `LIMIT`. Returns `setof jsonb`, capped to 500
rows / 10 KB serialized at the function boundary. Tools 1–5 do **not** call
this function; they execute parametrised SQL via the read-only role directly.

## 12. Relevance guard

- **Model:** `gpt-4o-mini` (~200 input tokens, 1 output token typical).
- **Output:** single token `on` or `off`.
- **Greetings, "what can you do?", "how do I use this?" → `on`** (the agent
  answers naturally about its own scope).
- **Always run.** Never skip. Cost ~0.0002¢ per check is well under the savings
  on rejecting one off-topic agent run.

## 13. Logging & rate limiting

### `ask_ai_logs` schema

```sql
CREATE TABLE public.ask_ai_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        text NOT NULL,                 -- phase 0: localStorage UUID
                                                    -- phase 1: auth.uid()::text
  question          text NOT NULL,
  answer            text,                           -- null on error
  status            text NOT NULL,                  -- 'ok' | 'rate_limited' |
                                                    --  'off_topic' | 'iteration_cap' |
                                                    --  'token_budget' | 'tool_failed' |
                                                    --  'model_failed' | 'sql_rejected'
  error_code        text,
  tools_used        jsonb NOT NULL DEFAULT '[]',    -- [{name, args, result_bytes, ms}]
  iterations        smallint NOT NULL DEFAULT 0,
  prompt_tokens     integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens      integer NOT NULL DEFAULT 0,
  duration_ms       integer NOT NULL,
  client_ip         inet,                           -- global cap fallback
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ask_logs_session_created ON ask_ai_logs (session_id, created_at DESC);
CREATE INDEX idx_ask_logs_created         ON ask_ai_logs (created_at DESC);
```

RLS: enabled with no policies (writes go through the service role from the API
route, which bypasses RLS). The `anon` role gets no grants on this table.
Phase 1 will add an `auth.uid()`-scoped SELECT policy when sign-in lands.

### Rate-limit query

One SELECT before each request:

```sql
SELECT
  count(*) FILTER (WHERE session_id = $1) AS session_count,
  count(*) AS global_count
FROM ask_ai_logs
WHERE created_at > now() - interval '1 hour';
```

- **Per session:** 30/hour (any status counts, including `OFF_TOPIC` — discourages
  spamming the guard).
- **Global:** 200/hour across all sessions.

When over either limit, emit `RATE_LIMITED` with the cooldown timestamp from
the oldest in-window log row.

## 14. UI

### Tab placement

Add `Ask AI` to the `TABS` array in `frontend/src/App.tsx` (icon: `Sparkles`
from `lucide-react`). New page lives at `frontend/src/pages/AskAI.tsx`.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Ask AI                                                     │
│  Ask anything about your affiliate performance data.        │
├─────────────────────────────────────────────────────────────┤
│  ┌─ Thread (in-memory, scrolls) ─────────────────────────┐  │
│  │ You: What were the top 5 affiliates by profit in Q1?  │  │
│  │                                                        │  │
│  │ AI: Here are your top 5 affiliates...                 │  │
│  │     | Rank | Affiliate | Profit |                     │  │
│  │     ...                                                │  │
│  │                                                        │  │
│  │ You: Compare January to February                      │  │
│  │ AI: ⚙ Analyzing performance data...                   │  │ ← live status
│  │     ⚙ Comparing time periods...                       │  │
│  │     Revenue grew 12% from January to F▮                │  │ ← streaming tokens
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [ Ask a question about your data...           ] [ ▶ ]  │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

Matches existing dark-theme aesthetic (`chart-card` borders, palette, fonts).

### Component breakdown

- `<AskAI />` (page) — owns thread state, session_uuid, calls `useAskStream`.
- `<MessageThread />` — renders `Message[]`, auto-scrolls.
- `<UserMessage />` / `<AssistantMessage />` — bubbles; assistant renders
  markdown via `react-markdown`.
- `<StatusLine />` — inside the in-progress assistant bubble; rotates as
  `status` events arrive.
- `<AskInput />` — controlled input, submit, Ctrl/Cmd-Enter; disables while a
  request is in flight.
- `<ErrorBanner />` — typed renderer per error code.
- `useAskStream(question)` — hook wrapping `fetch` + `ReadableStream` reader,
  parses SSE frames, dispatches typed events into a reducer.

### `Message` shape (matches `done` payload — phase 1 history persists this verbatim)

```ts
type Message =
  | { role: 'user',
      text: string,
      ts: number }
  | { role: 'assistant',
      text: string,
      tools_used: string[],
      prompt_tokens: number,
      completion_tokens: number,
      total_tokens: number,
      duration_ms: number,
      log_id: string,
      ts: number }
  | { role: 'assistant_error',
      code: ErrorCode,
      message: string,
      ts: number };
```

### Session UUID

Stored in `localStorage` under key `roi_dashboard_ask_session_id`, created on
first AskAI mount via `crypto.randomUUID()`.

### Friendly status message copy (initial; user to refine)

| Trigger                       | Message                          |
| ----------------------------- | -------------------------------- |
| Before relevance guard        | `Reading your question…`         |
| Before agent first call       | `Analyzing performance data…`    |
| Before `get_kpi_summary`      | `Crunching the numbers…`         |
| Before `get_top_n`            | `Finding the top performers…`    |
| Before `get_time_series`      | `Looking at the trend…`          |
| Before `compare_periods`      | `Comparing time periods…`        |
| Before `get_funnel`           | `Walking the funnel…`            |
| Before `run_safe_sql`         | `Pulling custom data…`           |
| Generation phase              | `Putting the answer together…`   |

Mapping `tool_name → friendly copy` lives in one config object on the server.
Tool names never cross the wire.

## 15. Testing strategy

### Strict TDD (test first, red → green → refactor) — pure logic, no I/O

- `safety/sqlValidator.ts` — every reject rule, the `LIMIT` injection, the
  schema allowlist.
- `safety/relevanceGuard.ts` — parsing/decision layer (LLM call mocked).
- `_lib/agent.ts` — iteration cap, token budget, tool-result truncation (model
  stubbed).
- `_lib/rateLimit.ts` — boundaries at 29/30/31 and 199/200/201.
- `_lib/sseEncoder.ts` — frame format.
- Any KPI math helpers that move server-side.

### Lightweight mocks + one integration test per tool DB layer

- Each `tools/*.ts` gets unit tests with a mocked `pg` client covering arg→SQL
  shape and result→return shape.
- One real-Supabase integration test per tool against a seeded
  `performance_records_test` fixture. Run in CI with a Supabase project URL
  secret; skip locally if unset.

### One end-to-end test for the route

- POST a real question; mock OpenAI with a recorded transcript (`nock`); assert
  the SSE event sequence and final `done` payload shape.
- Second e2e exercises each error code path.

### Frontend tests (Vitest + React Testing Library)

- `useAskStream` consumes a fake `ReadableStream` of SSE frames and dispatches
  the right reducer actions.
- `<AskAI />` renders user → status → tokens → done correctly.
- Each error code → correct `ErrorBanner` variant.

## 16. Open implementation choices (decide during plan)

These are deliberately deferred to the implementation plan, not blocking spec
approval:

- Whether `api/` is a separate npm package or shares root `node_modules` via
  npm workspaces (affects `vercel.json` `installCommand`).
- Markdown renderer choice (`react-markdown` vs `marked` + `dompurify`).
- Whether status events fire only at iteration boundaries or also mid-tool.
- Exact wording of friendly status messages (user to edit table in §14 before
  shipping).
- Final relevance-guard prompt wording.

## 17. Acceptance criteria

A reviewer can mark this build done when:

1. Asking a typical question (e.g. "Top 5 affiliates by profit in Q1?")
   completes end-to-end with streamed status + tokens + final answer in <10 s.
2. Each of the 7 error codes is reachable and renders the right banner.
3. Rate limit triggers exactly at the 31st request in a session within an hour.
4. `run_safe_sql` rejects every entry in a curated list of malicious SQL
   (DELETE, DROP, multi-statement, schema escape, `pg_*`, etc.).
5. The `ask_ai_readonly` role provably cannot SELECT from `ask_ai_logs` or any
   table other than `performance_records`.
6. All TDD-target modules have tests and pass red→green→refactor.
7. The streaming `done` payload matches the `Message['assistant']` shape
   verbatim, so phase-1 history will be a drop-in.
8. No tool names, SQL strings, or column names appear in any user-facing
   message (status, error, or answer).
