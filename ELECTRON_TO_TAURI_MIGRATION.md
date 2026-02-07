# Electron → Tauri Migration Prompt

## Purpose

Migrate an existing **Electron** application to **Tauri** **without changing business logic or UX**. Every capability must be ported piece‑by‑piece into **Rust (Tauri core)** while keeping **frontend behavior, APIs, and interfaces identical**. The process is incremental, verifiable, and reversible at each step.

This document is a **master prompt** you can reuse with a coding model to execute the migration safely.

---

## Core Constraints (Non‑Negotiable)

* ❌ **No logic changes** (behavioral parity is mandatory)
* ❌ **No UI/UX changes** (pixel‑level parity preferred)
* ❌ **No feature merging or refactoring unless explicitly approved**
* ✅ **One capability at a time**
* ✅ **Every change reflected across all dependent frontend locations**
* ✅ **Each step must compile, run, and be testable before moving on**

---

## Global Rules for the Coding Model

Use these rules verbatim in every step:

> You are migrating, not redesigning.
> Treat Electron behavior as the source of truth.
> If something feels inefficient but matches Electron, KEEP IT.
> If unsure, ASK before modifying.
> Prefer explicit code over abstractions.
> Every Rust command must mirror an Electron IPC call or Node API.

---

## Phase 0 — Inventory & Ground Truth

### Prompt 0.1 — Electron System Map

```
Act as a senior cross‑platform desktop engineer.

Analyze the Electron codebase and produce:
1. A complete map of:
   - main process responsibilities
   - preload scripts
   - IPC channels (name, payload, response)
   - Node APIs used (fs, net, child_process, crypto, etc.)
2. A dependency graph showing which frontend files depend on which IPC calls
3. A list of OS‑level capabilities used (filesystem, tray, notifications, auto‑start, etc.)

Do NOT refactor or suggest improvements.
Output must be structured and exhaustive.
```

### Output Artifacts

* IPC Contract Table
* Capability Matrix (Electron → OS)
* Frontend → Backend dependency map

---

## Phase 1 — Tauri Skeleton (No Logic Yet)

### Prompt 1.1 — Minimal Tauri Shell

```
Create a minimal Tauri project that:
- Uses the existing frontend unchanged
- Builds and runs successfully
- Does NOT implement any business logic
- Does NOT remove Electron yet

Keep all Electron IPC calls mocked or stubbed.
```

### Rules

* Frontend must compile with zero code changes
* IPC calls may return hardcoded placeholders

---

## Phase 2 — IPC Parity Layer

### Prompt 2.1 — IPC Mapping

```
For each Electron IPC channel identified earlier:

1. Create a corresponding Tauri command in Rust
2. Match:
   - command name
   - input shape
   - output shape
   - sync vs async behavior
3. Do NOT implement logic yet
4. Wire frontend calls to Tauri invoke() with identical signatures

Produce a one‑to‑one IPC parity layer.
```

### Validation Checklist

* All IPC names preserved
* Frontend code changes are mechanical only
* No behavioral differences

---

## Phase 3 — Capability‑by‑Capability Migration

⚠️ **This phase is strictly sequential. One capability at a time.**

### Prompt Template (Repeat for Each Capability)

```
Migrate the following Electron capability to Tauri:

Capability Name: <exact name>
Electron Source Files: <paths>
Frontend Dependents: <files>

Steps:
1. Identify the exact Electron behavior
2. Re‑implement it in Rust using Tauri APIs
3. Match error handling and edge cases exactly
4. Update frontend references if needed (without changing behavior)
5. Provide a diff‑style summary

Do NOT optimize or redesign.
Stop after this capability is fully working.
```

### Examples of Capabilities

* Filesystem access
* App paths
* Tray
* Auto‑launch
* Native dialogs
* Notifications
* Background processes
* Network access

---

## Phase 4 — Preload Script Elimination

### Prompt 4.1 — Preload Replacement

```
Replace Electron preload scripts by:
1. Moving exposed APIs into Tauri commands
2. Preserving the same JS interface
3. Removing preload usage gradually

Ensure no frontend API surface changes.
```

---

## Phase 5 — Frontend Consistency Sweep

### Prompt 5.1 — Dependency Reconciliation

```
Scan the entire frontend and verify:
- All former Electron references are removed
- All replacements use Tauri invoke()
- No dangling imports or dead code

Report any mismatch or behavioral risk.
```

---

## Phase 6 — Electron Removal

### Prompt 6.1 — Safe Deletion

```
Remove Electron from the project ONLY IF:
- All features are verified in Tauri
- No IPC channel is missing
- App behavior matches Electron

List deleted files and why they are safe to remove.
```

---

## Phase 7 — Packaging & Parity Validation

### Prompt 7.1 — Final Validation

```
Perform a parity audit between Electron and Tauri versions:
- Startup behavior
- Error handling
- Performance characteristics
- OS‑specific quirks

Highlight differences ONLY if unavoidable.
```

---

## Final Output Expectations

* A fully working Tauri app
* Identical UX and logic
* Clean, explicit Rust code
* Confidence that nothing silently changed

---

## How to Use This Document

1. Start at Phase 0
2. Copy ONE prompt at a time into your coding model
3. Do not skip phases
4. Do not batch steps

Slow is smooth. Smooth is fast.
