# Release and Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove requirement-by-requirement completion, create a judge-proof demo path, and push every deliverable branch.

**Architecture:** Main owns the cross-project scorecard and demo orchestration; each deliverable
branch owns its implementation and branch-specific README. Verification uses current source,
runtime output, rendered UI, tests, and remote branch state as independent evidence.

**Tech Stack:** Git worktrees, Bash smoke script, Node/Expo/Vite toolchains, Markdown

---

### Task 1: Requirements scorecard

**Files:**
- Modify: `/Users/softxpert/incident-triage/DEMO.md`
- Create: `/Users/softxpert/incident-triage/REQUIREMENTS.md`

- [ ] Create one row for every core, web, and mobile PDF item, including every optional and bonus.
- [ ] For each row record branch, feature, source path, verification command or demo action, and
  status. Do not mark a row complete from README claims alone.
- [ ] Remove old “Deferred” claims that are now implemented and preserve only genuine platform
  limitations with their mock/adapter evidence.
- [ ] Commit as `docs: add competition requirements scorecard`.

### Task 2: One-command judge preparation

**Files:**
- Create: `/Users/softxpert/incident-triage/scripts/demo-check.sh`
- Modify: `/Users/softxpert/incident-triage/scripts/smoke.sh`
- Modify: `/Users/softxpert/incident-triage/README.md`

- [ ] Add strict shell checks for clean contract hashes, expected Node version, dependencies,
  backend tests/typecheck, web tests/build, mobile tests/typecheck/dependency check, and golden
  numbers.
- [ ] Keep the existing runtime smoke checks and make failures print one actionable line.
- [ ] Document exact three-terminal startup plus a 90-second and 7-minute judge walkthrough.
- [ ] Run the script end to end and commit as `chore: add one-command demo verification`.

### Task 3: Visual and runtime acceptance

**Files:**
- Modify only if evidence reveals defects: relevant branch source and tests

- [ ] Start backend in rule-only mode and web in mock and live modes.
- [ ] Capture desktop light/dark and mobile-width dashboard screenshots; inspect all key states.
- [ ] Start Expo web preview and inspect login, dashboard, detail, quick actions, and offline-safe
  fallbacks.
- [ ] Run valid and invalid uploads, status/assignment/ack/note changes, exports, live refresh,
  notification demo, and cross-client refresh.
- [ ] Fix every observed defect test-first and repeat the affected acceptance step.

### Task 4: Final verification and push

**Files:**
- No planned source changes

- [ ] Fetch origin and confirm no branch is behind or diverged.
- [ ] Confirm `contract/` matches its original tree on all four branches.
- [ ] Run `scripts/demo-check.sh`, branch-specific test/build/typecheck commands, and
  `git diff --check`.
- [ ] Confirm all four worktrees are clean and review every outgoing commit.
- [ ] Push `main`, `backend`, `frontend`, and `mobile` explicitly.
- [ ] Verify remote heads equal local heads and only then report completion.
