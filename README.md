# myagent

> **The terminal AI coding agent with no vendor lock-in.** Chat with any model from any provider —
> hard provider isolation, live model discovery, honest error handling, and a REPL that never dies.

![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License](https://img.shields.io/badge/license-ISC-blue)
![Version](https://img.shields.io/badge/version-1.1.0-black)
![Providers](https://img.shields.io/badge/providers-6%2B-orange)
![Models](https://img.shields.io/badge/models-77%20curated-blue)
![Dependencies](https://img.shields.io/badge/dependencies-3%20small-lightgrey)
![Lines](https://img.shields.io/badge/2%2C793%20lines-pure%20JS-9cf)
![Status](https://img.shields.io/badge/status-stable-green)

**~2.8k lines of plain JavaScript. No server. No database. No framework. Your keys, your models,
your choice** — switch between 6 providers and 77 verified models while you type.

---

## See it run

```console
$ myagent -m groq/openai/gpt-oss-20b "reply with exactly: myagent live demo OK"

  model: groq/openai/gpt-oss-20b

  ── assistant ──
myagent live demo OK

$ myagent --providers

  Providers:
  OpenRouter             ✓ configured  https://openrouter.ai/api/v1
  Groq                   ✓ configured  https://api.groq.com/openai/v1
  Mistral                ✓ configured  https://api.mistral.ai/v1
  Google Gemini          ✓ configured  https://generativelanguage.googleapis.com/v1beta/openai
  Z.ai (GLM)             ✓ configured  https://api.z.ai/api/paas/v4
  Hugging Face           ✓ configured  https://router.huggingface.co/v1
  OpenAI                 ✗ missing  https://api.openai.com/v1
  xAI (Grok)             ✗ missing  https://api.x.ai/v1
  Anthropic              ✗ missing  https://api.anthropic.com/v1
  Custom (OpenAI-compatible) ✗ missing  https://your-endpoint.example.com/v1
```

---

## Why

Most "AI coding agents" lock you into one vendor or one environment: one API key, one hard-coded
model, no way to swap, and a crash if the bill runs out. `myagent` inverts that: your terminal,
your `.env`, your call. It treats model providers as **swappable, independently-verified slots**
— bring your own keys, pick any model, and when something breaks it tells you *what* went wrong
and *what to do*, instead of dumping a stack trace.

Built for **students and hobbyists first**: every provider slot has a real free tier — OpenRouter,
Groq, Mistral, Gemini, Z.ai, Hugging Face all work with $0 balance. Adding a brand-new provider
is a ~20-line config block.

---

## Features

- **6 providers, hard-isolated** — OpenRouter, Groq, Mistral, Google Gemini, Z.ai (GLM),
  Hugging Face. Each has its **own** credentials, catalog, live discovery, cache, and error policy.
  **No silent cross-provider fallback** — a failure stays with its provider.
- **77-model curated catalog** — one JSON-ish dict in `src/config.js`; every id is verified live.
  Plus **auto-discovery**: each provider's `/models` endpoint is pulled and cached 24h
  (`~/.myagent/providers/<id>.json`).
- **Job-first model selection** — `/model-category` shows the models you actually want per job
  (all-rounder, coding, UI/UX, research, planning, docs, review, speed, free), marks a ★ best pick,
  then asks *"enter a number or id to switch"*.
- **10 built-in tools** — `bash`, `read`, `write`, `edit`, `apply_patch`, `glob`, `grep`, `list`,
  `glob_read`, `webfetch` — gated by an allow/ask/deny permission system with `always`/`skip`
  remember answers for bash.
- **Resilient by design** — transient errors retry with bounded backoff (honoring `Retry-After`);
  HTTP 402 *shrinks the output budget* instead of failing; if a request still fails you get a
  recovery menu, not a crash: `[R] retry · [M] model · [P] provider · [X] exit`.
- **Provider-first everywhere** — model ids split on the **first** slash:
  `groq/openai/gpt-oss-120b` → provider `groq`, model `openai/gpt-oss-120b`. No ambiguity tricks.
- **Zero lock-in** — your keys, your `.env`, your model choice. Sessions auto-save every turn.

---

## Quick start

```bash
myagent                              # interactive chat (REPL)
myagent "explain this file"          # one-shot: ask, print, exit
myagent -m groq/openai/gpt-oss-20b "run the tests"
myagent --list-models                # full 77-model catalog
myagent --providers                  # provider slots + key status
```

Requirements: **Node.js 18+** (developed on 22) and at least one API key.

```bash
cd myagent
npm link                # or: npm install -g .  → `myagent` on PATH
# copy .env.example → .env and fill in the keys you have
myagent --providers     # verify slots are configured
```

---

## Providers

| Provider | Key var | Base URL | Free tier |
|---|---|---|---|
| OpenRouter | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` | 25+ `:free` models, $0 balance |
| Groq | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` | permanent free, no card |
| Mistral | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` | ~1B tokens/month (phone verify) |
| Google Gemini | `GEMINI_API_KEY` | `generativelanguage.googleapis.com/v1beta/openai` | generous daily free |
| Z.ai (GLM) | `ZAI_API_KEY` | `https://api.z.ai/api/paas/v4` | ~1,000 req/day (needs free Resource Package) |
| Hugging Face | `HF_TOKEN` | `https://router.huggingface.co/v1` | free monthly credits |
| OpenAI | `OPENAI_API_KEY` | official | — (add a key to activate) |
| xAI (Grok) | `XAI_API_KEY` | official | — (add a key to activate) |
| Anthropic | `ANTHROPIC_API_KEY` | official | — (add a key to activate) |
| Custom | any OpenAI-compatible | your endpoint | configure in `config.json` |

- Keys are read from: **shell → current folder `.env` → myagent folder `.env` → `~/.myagent/.env`**.
- `myagent --providers` shows ✓ configured / ✗ missing per slot.
- Z.ai is free but you must claim a **Resource Package** at https://platform.z.ai first —
  otherwise the API returns HTTP 429 *"Insufficient balance"*, which myagent correctly
  classifies as `quota` (a real account problem, not a rate limit).

---

## Choosing a model (the fun part)

Model ids are `provider/model` — split on the first `/`. Curation lives in the code, discovery
augments it:

```
/model-category          PER JOB: pick from 9 jobs, see ★ best + all catalog models for it,
                         then "enter a number or id" to switch. (alias: /model category)
/model category coding   jump straight to the coding job
/model                   provider-first: pick provider → pick its model
/model <id>              direct: /model gpt-4o · /model groq/gpt-oss-20b · /model codestral
/models                  flat numbered menu across every provider
/provider                pick a provider, then a model from it
/provider groq           jump to a specific provider's picker
/providers               config status (✓ / ✗ + base URL)
Tab                      completes partial /model or /provider ids
```

Every job group is built **only from the 77 catalog models** (verified: 77/77 covered, 0 hidden):

| Job | ▶ star pick | Also includes |
|---|---|---|
| ALL-ROUNDER | `openrouter/openai/gpt-6-astra` | every `general` model |
| CODING | `openrouter/openai/gpt-5.1-codex` | every `coding` model (`codestral`, `qwen3-coder`…) |
| UI/UX | `openrouter/deepseek/deepseek-v4-pro` | general + fast models |
| REASONING / RESEARCH | `openrouter/anthropic/claude-opus-5` | every `reasoning` model |
| PLANNING / ARCHITECTURE | `openrouter/openai/gpt-6-astra` | reasoning + general |
| DOCUMENTATION | `openrouter/anthropic/claude-fable-5.1` | general + coding |
| REVIEW | `openrouter/anthropic/claude-opus-5` | reasoning + coding |
| SPEED | `google/gemini-3.6-flash` | every `fast` model |
| FREE ($0) | `openrouter/nvidia/nemotron-3-super-120b-a12b:free` | every `free` model |

> Full research shortlist with per-job rationale lives in `docs/MODEL-RESEARCH.md` (kept out of the
> repo — it's review material, not a claim). Re-run `node tools/test-models.js all free` to
> re-verify `.free` slugs anytime.

---

## Command reference

### CLI

| Command | What it does |
|---|---|
| `myagent` | Interactive REPL |
| `myagent "question"` | One-shot |
| `-m, --model <id>` | Use a specific model |
| `--list-models` | Print the 77-model catalog |
| `--providers` | Provider slots + key status |
| `--config-path` | Print config location |
| `-s, --session <id>` | Resume a session |
| `--cwd <dir>` | Work in another folder |
| `-v, --verbose` | Verbose logging |
| `--no-color` | Disable ANSI colors |

### REPL

| Command | Aliases | What it does |
|---|---|---|
| `/model-category` | `/model category` | Best models by job → switch |
| `/model` | — | Provider-first picker |
| `/model <id>` | — | Direct / fuzzy switch |
| `/models` | — | Flat numbered model menu |
| `/provider` | — | Pick provider → model |
| `/providers` | — | Config status |
| `/permissions` | — | Show tool permissions |
| `/config` | — | Open config in editor |
| `/clear` | — | Reset conversation |
| `/undo` | — | Remove last assistant turn |
| `/sessions` | — | List saved sessions |
| `/load <id>` | — | Resume a session |
| `/save <name>` | — | Save current conversation |
| `/help` | `/?` | Show help |
| `/exit` | `/quit`, `Ctrl+C` | Quit |

Menus accept a **number**, an **exact id/name**, or a **partial** (single match → instant switch).
`0` or empty Enter cancels. End a line with `\` for multiline input.

---

## Tools & permissions

The agent can act on your machine only through these 10 tools, each gated by a permission rule
(`~/.myagent/config.json`):

| Tool | Purpose | Default |
|---|---|---|
| `bash` | run shell commands (cmd `/c` on Windows) | **ask** + `always`/`skip` remember |
| `read` | read files with line numbers, offset/limit | allow |
| `write` | create / overwrite files | **ask** |
| `edit` | exact-string replacement (unique match enforced) | **ask** |
| `apply_patch` | unified-diff style patches (add/update/delete/move) | **ask** |
| `glob` | find files by pattern (ripgrep, node fallback) | allow |
| `grep` | regex content search (ripgrep, node fallback) | allow |
| `list` | list a directory | allow |
| `glob_read` | read many files at once | allow |
| `webfetch` | fetch a URL → markdown/text | **ask** |

Non-interactive (piped) mode auto-denies `ask` tools instead of hanging — the model adapts and
continues. Common safe bash commands (`git status`, `ls`, `cd`, `node -v`…) bypass the prompt.

---

## Error handling & resilience

`src/errors.js` turns raw API failures into a classification with a **fix hint**:

| Kind | Trigger | Retry? |
|---|---|---|
| `auth` | 401 / 403 | no |
| `quota` | 402, "insufficient balance", "more credits" | no (auto budget shrink) |
| `not_found` | 404 | no |
| `rate_limit` | 429 (honors `Retry-After`) | yes, bounded backoff |
| `timeout` | 408, ETIMEDOUT | yes |
| `server` | 5xx | yes |
| `network` | ENOTFOUND / ECONNRESET / fetch failed | yes |
| `capability` | "does not support tool calls" | no |

- **Bounded retry** — up to 3 retries, `retryAfter || 2^n·s`, capped at 8s (verified live:
  Mistral 429 → `1s→2s→4s`).
- **402 shrink** — if the balance can't afford the output budget, max_tokens halves (4096→256)
  and the task still completes.
- **Recovery menu instead of crash** — `[R] retry` (keeps your prompt) · `[M] model` · `[P] provider`
  · `[X] exit`. The REPL never dies.
- **Never switches providers on you** — a Groq failure stays Groq; you decide to move with `[P]`.

---

## Sessions & state

- Every conversation auto-saves to `~/.myagent/sessions/*.json` after each turn.
- Sessions store `{id, title, messages, model, provider}`; `/load` re-validates the provider key.
- Config lives in `~/.myagent/config.json` — created fresh on first run (small, diff-based save:
  only your overrides are written). Custom models are added under `provider.<name>.models`.
- Balances: `src/balance.js` checks your OpenRouter credits at startup and warns
  (critical < $0.10) / reminds at $1.00 — once per 6h per level.

---

## Architecture

### Overview

                                ```
            you
             │
             ↓
      ┌─────────────┐
      │   myagent   │
      │    CLI      │
      └──────┬──────┘
             │
┌────────────┼────────────┐
↓            ↓            ↓
Commands   Model System  Sessions
   │            │            │
   │            ↓            │
   │      Provider Router    │
   │            │            │
   │   ┌────────┼────────┐   │
   │   ↓        ↓        ↓   │
   │  Groq   Gemini   Mistral│
   │    │        │        │   │
   │   └────────┼────────┘   │
   │            │            │
   ↓            ↓            ↓
 File Tools    AI Response  Save/Load
   │
┌────┼────┐
↓    ↓    ↓
Read Edit Terminal
```

### How a request flows

```
you type "fix this bug"
        │
        ▼
src/repl.js            interactive loop, auto-save, /commands, recovery menu
        │  state.messages += prompt
        ▼
src/agent.js  runAgent()
        │  resolveModel() → pick provider/model          src/models.js
        │  ensureApiConfig() → this provider's OWN key    src/models.js ↔ sources/providers.js
        │  buildSystemPrompt(cwd) → OpenAI-compatible call
        ▼
       streaming loop  (src/agent.js requestModel)
        │   402 → shrink max_tokens (4096→256)  ·  429/5xx/timeout/network → bounded backoff
        ▼
   model returns tool_calls? ──yes──▶ execute tool with permission check (src/permissions.js)
        │                               │  allow/ask/deny, bash always/skip, non-TTY auto-deny
        ▼                               ▼
   final answer <────── loop with tool results appended (max 30 steps)
        │
        ▼
src/repl.js    on failure: classifyError() → [R]/[M]/[P]/[X] recovery (never crashes)
```

### Provider isolation (the core idea)

Each provider is a self-contained slot — **key, base URL, capabilities, discovery, cache, and
error policy travel together** and never leak across slots:

```
provider slot = { envKeys, baseURL, capabilities, discovery?, modelFilter }
                    │
    ┌───────────────┼──────────────────────────────┐
    ▼               ▼                              ▼
resolveKey()   discoverModels()                classifyError()
only ITS keys    GET /models (8s abort)        + provider-aware hints
per slot        filter + 24h cache             (OpenRouter credit hint only for openrouter)
```

- `ensureApiConfig()` throws *"No API key for provider X. Add X to your .env"* — it **never
  borrows** another provider's key.
- Discovery cache lives outside the repo at `~/.myagent/providers/<id>.json`, so it's never
  committed and survives across runs.
- A failure is always reported **with the failing provider's context**; retries never switch
  providers behind your back.

### File layout

```
index.js           CLI entry — commander flags, one-shot, REPL bootstrap, balance alert
src/repl.js        interactive REPL, numbered menus, /model-category picker, recovery
src/providers.js   provider slot definitions — keys, base URLs, capabilities, discovery
src/config.js      77-model curated catalog + config load/save (deep merge/diff)
src/models.js      catalog list + namespace resolution (first-slash split)
src/agent.js       runAgent — streaming loop, tool calls, 402-shrink + bounded retry
src/tools.js       10 tools; bash sandbox, edit safety, rg-with-node-fallback
src/permissions.js allow/ask/deny checker, bash always/skip memory, non-TTY auto-deny
src/errors.js      classifyError + Retry-After parser + formatError hints
src/balance.js     OpenRouter credit alert (warn/critical)
src/ui.js          colored logging (ANSI-safe, suppressible)
tools/test-models.js  smoke test: one trivial request per catalog model
```

Dependencies: `openai` (chat streaming SDK), `dotenv` (key loading), `commander` (CLI parsing).
No database, no server, no config framework — Node built-ins + 3 small libraries.

---

## Testing (verified live, 2026-09-05)

One coding question (`length_of_longest_substring(s)` in Python) sent to **every configured
provider**:

| Provider | Model | Result |
|---|---|---|
| Groq | `groq/openai/gpt-oss-20b` | ✅ code returned |
| Google Gemini | `google/gemini-3.7-flash` | ✅ code returned |
| Mistral | `mistral/codestral-latest` | ✅ code returned |
| Hugging Face | `huggingface/Qwen/Qwen3-30B-A3B` | ✅ code returned |
| Z.ai | `zai/glm-4.5` | ⚠ `quota` — correctly classified; needs free Resource Package claimed |

Deterministic suites (reproducible, no network-mocked — these run against real modules):

| Area | Verified | Result |
|---|---|---|
| Credential isolation | unconfigured provider → clear "No API key" error, never borrows another key | ✅ |
| Namespace resolution | first-slash split; exact / scoped / ambiguous(`gpt-4o`→null) / unique-global | ✅ |
| Discovery + cache | groq 4 · mistral 23 · zai 10 · google 4 · huggingface 141; corrupted cache → fallback | ✅ |
| Error classification | 401→auth … Z.ai balance→quota … tool-calls→capability: **11/11** | ✅ |
| Retry-After honor | 429 with `retry-after: 7` → wait 7s | ✅ |
| Recovery menu | `[R]/[M]/[P]/[X]`, invalid input re-prompts, non-TTY auto-continues | ✅ |
| Session round-trip | `{provider, model, messages}` survives save/load | ✅ |
| Catalog integrity | 7 providers, 77 models, OpenRouter block (43) untouched — **no OpenRouter calls in tests** | ✅ |
| Syntax gate | `node --check` on all modules | ✅ |

Try it yourself:

```bash
myagent --providers
myagent --list-models
myagent -m groq/openai/gpt-oss-20b "reply with: OK"
myagent -m google/gemini-3.8-flash "solve length_of_longest_substring in python"
```

---

## Design trade-offs (honest)

Every choice here is deliberate — here's what we traded:

- **Chat-only fallback**: Hugging Face's router doesn't support tool calls, so it's a pure chat
  fallback (`[tools —]` in menus) — by design, not a bug.
- **Simple patches**: `apply_patch` handles clean unified diffs; for anything exotic, use
  `write`/`edit` — the tools already know how.
- **Free-model drift**: `.free` model slugs go paid or disappear over time — the
  `node tools/test-models.js all free` smoke test is there for exactly that.
- **Budget honesty**: OpenRouter free tier is ~$0.40 of daily credits; the 402-shrink keeps small
  tasks alive when credit runs low instead of failing hard.
- **Account setup reality**: Z.ai and the paid OpenRouter slots need the free-tier signup claimed
  (Resource Package at platform.z.ai) — myagent calls this out as `quota`, not a rate limit,
  because that's the truth.

---

## Contributing

The codebase is ~2.8k lines of plain JS, no framework, no build step — every function is readable
in one screen. Good first contributions:

- Add a provider slot in `src/providers.js` (env key + baseURL + discovery filter + capabilities).
- Expand the curated catalog in `src/config.js` with a verified model.
- Add a job entry to the `JOB_CATEGORIES` table in `src/repl.js` (best pick + catalog ids + category).

Run `node --check src/*.js index.js` before opening a PR.

---

## License

ISC — see [LICENSE](./LICENSE). Free for any use (personal, academic, commercial).