# myagent

> A terminal AI coding agent with **manual, provider-first model selection**. Chat with any model,
> from any provider, right in your terminal — with hard provider isolation, live model discovery,
> honest error handling, and a REPL that never dies.

![Status](https://img.shields.io/badge/status-stable-green)
![License](https://img.shields.io/badge/license-ISC-blue)
![Version](https://img.shields.io/badge/version-1.0.0-black)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

**Last updated:** 2026-09-05 · Provider-isolation build (v1.1)

---

## Why

The RooCode VS Code extension kept failing, and most "AI coding agents" are twitchy, expensive, or
lock you to one vendor. `myagent` is the opposite: a lean CLI (12 source files, no server, no
database) that talks to **six independent providers with your own API keys**, gives you an honest
numbered-menu model picker instead of a black-box default, and classifies every error with a fix
hint instead of dumping a stack trace.

It is built for **students and hobbyists first**: every provider slot has a real free tier, and the
whole design (decoupled key/model/discovery/error handling per provider) means adding a new provider
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

> Full research shortlist with per-job rationale: `docs/MODEL-RESEARCH.md` (kept local).

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
| Z.ai | `zai/glm-4.5` | ⚠ quota — Resource Package not yet claimed |

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

## Known limitations

- `apply_patch` handles simple unified diffs; exotic hunks may fail — prefer `write`/`edit`.
- `grep`/`glob` prefer ripgrep; a node fallback kicks in when it's absent (force with
  `MYAGENT_NO_RG=1`).
- Free `.free` model slugs drift (become paid or disappear) — re-run
  `node tools/test-models.js all free` periodically.
- `openrouter/free` budget ~4000 credits; the 402-shrink keeps small tasks alive when credit is low.
- Hugging Face doesn't support tool calls on its router (`[tools —]` in menus) — it's a chat-only
  fallback, by design.
- Z.ai and the paid OpenRouter model slots need the account/resource setup fixed first.

---

## Contributing

The codebase is ~2,500 lines, no framework, plain functions. Good first contributions:

- Add a provider slot in `src/providers.js` (env key + baseURL + discovery filter + capabilities).
- Expand the curated catalog in `src/config.js` with a verified model.
- Add a job entry to the `JOB_CATEGORIES` table in `src/repl.js` (best pick + catalog ids + category).

Run `node --check src/*.js index.js` before opening a PR.

---

## License

ISC — see [LICENSE](./LICENSE). Free for any use (personal, academic, commercial).