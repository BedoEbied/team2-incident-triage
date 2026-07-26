# Backend AI Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure, cached OpenAI and Claude CLI incident analysis with deterministic fallthrough while preserving every parser, grouping, API, and persistence invariant.

**Architecture:** The `Analyzer` port becomes asynchronous. A chain composes independently testable providers, validates every untrusted result, caches by fingerprint/provider version, and uses a four-slot semaphore. SQLite receives validated analyses after grouping and before the commit transaction.

**Tech Stack:** TypeScript, Node.js, Express, better-sqlite3, official OpenAI SDK, Node test runner

---

### Task 1: Analysis validation and prompt boundary

**Files:**
- Create: `/Users/softxpert/triage-backend/src/infra/analyzers/analysis-schema.ts`
- Create: `/Users/softxpert/triage-backend/src/infra/analyzers/prompt.ts`
- Create: `/Users/softxpert/triage-backend/tests/analyzer-security.test.ts`

- [ ] **Step 1: Write the failing tests**

Test that `validateAnalysis` rejects an unknown severity and missing strings, clamps confidence,
caps strings, and removes control characters. Test that `buildAnalysisPrompt` truncates messages
and stacks, contains `BEGIN_UNTRUSTED_LOG_DATA`, and places prompt-injection text only inside that
block.

- [ ] **Step 2: Run the tests to verify failure**

Run:

```bash
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npx tsx --test tests/analyzer-security.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the pure functions**

Use this public shape:

```ts
export function validateAnalysis(input: unknown): Analysis | null;
export function buildAnalysisPrompt(group: GroupedIncident): string;
```

Accept only `Critical | High | Medium | Low`; sanitize title to 160 characters, summary/root cause
to 1,200, remediation to 1,600; strip C0/C1 controls except newline and tab; clamp a finite numeric
confidence into `0..1`. Prompt fields are message 2,000 characters, normalized message 2,000,
code 160, modules 10 entries of 240, and three stacks of 1,000 characters.

- [ ] **Step 4: Run the focused tests**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infra/analyzers/analysis-schema.ts src/infra/analyzers/prompt.ts tests/analyzer-security.test.ts
git commit -m "test: secure analyzer input and output"
```

### Task 2: Provider contract, retry, timeout, cache, and concurrency

**Files:**
- Modify: `/Users/softxpert/triage-backend/src/domain/ports.ts`
- Create: `/Users/softxpert/triage-backend/src/infra/analyzers/types.ts`
- Create: `/Users/softxpert/triage-backend/src/infra/analyzers/retry.ts`
- Create: `/Users/softxpert/triage-backend/src/infra/analyzers/analysis-cache.ts`
- Create: `/Users/softxpert/triage-backend/src/infra/analyzers/semaphore.ts`
- Create: `/Users/softxpert/triage-backend/tests/analyzer-runtime.test.ts`

- [ ] **Step 1: Write the failing runtime tests**

Cover one retry after a failure, timeout cancellation, cache hit avoiding a second provider call,
atomic cache reload, and a semaphore that never observes more than four active callbacks.

- [ ] **Step 2: Run the tests to verify failure**

```bash
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npx tsx --test tests/analyzer-runtime.test.ts
```

Expected: FAIL because the runtime modules are missing.

- [ ] **Step 3: Implement typed boundaries**

Use:

```ts
export interface AnalysisProvider {
  readonly name: string;
  readonly available: boolean;
  analyze(group: GroupedIncident, signal: AbortSignal): Promise<unknown>;
}

export interface Analyzer {
  analyze(group: GroupedIncident): Promise<Analysis>;
}
```

`withRetry` accepts an operation, `timeoutMs`, `retryDelayMs`, and an injectable delay function.
`FileAnalysisCache` owns one fixed path, validates loaded entries, and writes a sibling temporary
file before `rename`. `Semaphore.run` queues FIFO and releases in `finally`.

- [ ] **Step 4: Run focused tests**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ports.ts src/infra/analyzers/types.ts src/infra/analyzers/retry.ts src/infra/analyzers/analysis-cache.ts src/infra/analyzers/semaphore.ts tests/analyzer-runtime.test.ts
git commit -m "feat: add bounded analyzer runtime"
```

### Task 3: Rule and chain analyzers

**Files:**
- Move: `/Users/softxpert/triage-backend/src/infra/rule-analyzer.ts` to `/Users/softxpert/triage-backend/src/infra/analyzers/rule-analyzer.ts`
- Create: `/Users/softxpert/triage-backend/src/infra/analyzers/chain-analyzer.ts`
- Create: `/Users/softxpert/triage-backend/src/infra/analyzers/index.ts`
- Modify: `/Users/softxpert/triage-backend/tests/parser.test.ts`
- Create: `/Users/softxpert/triage-backend/tests/chain-analyzer.test.ts`

- [ ] **Step 1: Write failing chain tests**

Inject provider 1 as unavailable, provider 2 as invalid output, and assert the rule provider returns
the expected access-token result. Add a cache test and assert a provider exception never escapes
the chain.

- [ ] **Step 2: Run to verify failure**

```bash
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npx tsx --test tests/chain-analyzer.test.ts
```

Expected: FAIL because the chain does not exist.

- [ ] **Step 3: Implement the chain**

The constructor receives providers, rule analyzer, cache, semaphore, timeout, and retry delay.
For each available remote provider: check `${provider.name}:${fingerprint}:v1`, run through the
semaphore and retry helper, validate, cache, and return. Continue on unavailable, thrown, timed
out, or invalid output. Await and return the rule analyzer last.

- [ ] **Step 4: Update rule-specific tests and run**

Change rule analyzer assertions to `await analyzer.analyze(group)`. Run:

```bash
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npx tsx --test tests/chain-analyzer.test.ts tests/parser.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infra/analyzers src/infra/rule-analyzer.ts tests/chain-analyzer.test.ts tests/parser.test.ts
git commit -m "feat: chain analyzer providers safely"
```

### Task 4: OpenAI and Claude CLI providers

**Files:**
- Modify: `/Users/softxpert/triage-backend/package.json`
- Modify: `/Users/softxpert/triage-backend/package-lock.json`
- Create: `/Users/softxpert/triage-backend/src/infra/analyzers/openai-analyzer.ts`
- Create: `/Users/softxpert/triage-backend/src/infra/analyzers/claude-cli-analyzer.ts`
- Create: `/Users/softxpert/triage-backend/tests/provider-adapters.test.ts`

- [ ] **Step 1: Fetch current official SDK documentation**

Resolve and query the official OpenAI Node SDK with Context7 for strict JSON-schema Responses API
usage and current model configuration. Record the selected configurable default in the README.

- [ ] **Step 2: Install the official SDK**

```bash
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npm install openai
```

- [ ] **Step 3: Write failing adapter tests**

Inject a fake OpenAI client and fake process launcher. Assert the SDK receives a system instruction
without log content, a user prompt containing the delimited data, and strict schema output. Assert
Claude is invoked with `['-p', '--output-format', 'json']`, receives stdin, and never receives log
text in argv.

- [ ] **Step 4: Implement providers**

`createOpenAiProvider` is available only with a non-empty key and uses `OPENAI_MODEL` or the
documented default. `createClaudeCliProvider` is available only after `command -v`-equivalent
binary resolution; it uses `spawn(binary, args, { shell: false })`, writes the prompt to stdin,
collects bounded stdout, and respects `AbortSignal`.

- [ ] **Step 5: Run tests and commit**

```bash
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npx tsx --test tests/provider-adapters.test.ts
git add package.json package-lock.json src/infra/analyzers/openai-analyzer.ts src/infra/analyzers/claude-cli-analyzer.ts tests/provider-adapters.test.ts
git commit -m "feat: add OpenAI and Claude analysis providers"
```

### Task 5: Asynchronous persistence and composition

**Files:**
- Modify: `/Users/softxpert/triage-backend/src/infra/sqlite.ts`
- Modify: `/Users/softxpert/triage-backend/src/container.ts`
- Modify: `/Users/softxpert/triage-backend/src/seed.ts`
- Modify: `/Users/softxpert/triage-backend/tests/ingestion.test.ts`
- Modify: `/Users/softxpert/triage-backend/tests/seed.test.ts`
- Modify: `/Users/softxpert/triage-backend/tests/architecture.test.ts`

- [ ] **Step 1: Write failing async-ingestion tests**

Use an analyzer returning delayed promises and assert all groups are analyzed before persistence,
failure falls through at chain level, and golden counts remain unchanged.

- [ ] **Step 2: Run to verify failure**

```bash
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npx tsx --test tests/ingestion.test.ts tests/seed.test.ts
```

Expected: FAIL because repository code expects synchronous analysis.

- [ ] **Step 3: Refactor the persistence boundary**

Build grouped incidents, call `Promise.all` over the chain (the chain enforces four active remote
calls), then enter the SQLite transaction with `{ group, analysis }[]`. Do not await inside a
better-sqlite3 transaction. Compose providers/cache/semaphore only in `container.ts`.

- [ ] **Step 4: Run backend tests and typecheck**

```bash
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npm test
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npm run typecheck
```

Expected: all tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/infra/sqlite.ts src/container.ts src/seed.ts tests/ingestion.test.ts tests/seed.test.ts tests/architecture.test.ts
git commit -m "refactor: persist asynchronous AI analyses"
```

### Task 6: Full-text log search and documentation

**Files:**
- Modify: `/Users/softxpert/triage-backend/src/infra/sqlite.ts`
- Modify: `/Users/softxpert/triage-backend/tests/api.test.ts`
- Modify: `/Users/softxpert/triage-backend/README.md`
- Create: `/Users/softxpert/triage-backend/docs/api.md`

- [ ] **Step 1: Add a failing API test**

Search for a distinctive raw log/stack term absent from incident title/summary and assert the
matching incident is returned once.

- [ ] **Step 2: Implement the query**

Extend the parameterized list predicate with an `EXISTS` subquery joining `log_entry` to the
incident fingerprint and matching `message`, `stack`, `code`, or `module`. Escape no SQL manually;
continue using bound parameters.

- [ ] **Step 3: Document**

Add provider order, enablement, current default model, 10-calls-not-893 property, cache/fallback
behavior, environment variables, and route examples. Document every existing endpoint in
`docs/api.md`.

- [ ] **Step 4: Verify and commit**

```bash
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npm test
PATH=/Users/softxpert/.nvm/versions/node/v22.19.0/bin:$PATH npm run typecheck
git add src/infra/sqlite.ts tests/api.test.ts README.md docs/api.md
git commit -m "feat: search logs and document AI API"
```

### Task 7: Runtime verification

**Files:**
- Modify if evidence requires it: `/Users/softxpert/triage-backend/NOTES.md`

- [ ] **Step 1: Rule-only boot**

Start with `OPENAI_API_KEY` unset and a PATH excluding Claude. Assert the provider line reports
rules, seed prints 893 entries / 10 incidents / largest 661, and health/login/list/stats work.

- [ ] **Step 2: Available-provider boot**

If Claude CLI is installed and authenticated, boot with it and verify the same grouping invariants.
If OpenAI credentials are already present, verify OpenAI without printing the key. Otherwise mark
that adapter as stub-verified, not live-verified.

- [ ] **Step 3: Smoke test**

Run the repository smoke script with the backend and frontend processes active. Expected: all
checks pass.

- [ ] **Step 4: Record exact evidence and commit**

Write only unavailable live-integration limitations to `NOTES.md`; include exact tested provider
names and model identifier. Commit any resulting documentation.
