# myagent — User Guide

A terminal AI coding agent with manual model selection. Runs in your terminal as `myagent`.

> **Last updated:** 2026-09-05 — provider-isolation build (v1.1) + student tricks/token-saving guide (§11–12)

---

## 1. Getting started

```bash
myagent                            # start interactive chat (REPL)
myagent "explain this file"        # one-shot: ask and exit
myagent -m openrouter/free "hi"    # one-shot with a specific model
```

- Your config lives in `~/.myagent/config.json` (run `myagent --config-path` to see it).
- API keys go in `.env` (either in the myagent folder or `~/.myagent/.env`).
- Environment variables are read from: shell -> current folder `.env` -> myagent folder `.env` -> `~/.myagent/.env`.

---

## 2. Command-line options

| Flag | What it does |
|------|--------------|
| `myagent` | Start interactive session |
| `myagent "question"` | One-shot, no REPL |
| `-m, --model <id>` | Use this model (e.g. `openrouter/openai/gpt-4o`) |
| `--list-models` | Print the full catalog and exit |
| `--providers` | Show providers + whether each API key is set |
| `--config-path` | Print config file location |
| `-s, --session <id>` | Resume a saved session |
| `--cwd <dir>` | Work in a different folder |
| `-v, --verbose` | Extra logging |
| `--no-color` | Turn off ANSI colors |

---

## 3. The REPL and the model menu

Start `myagent`, type `/models` or `/model`:

- `/model`            -> provider-first: pick a provider, then a model from it
- `/provider`         -> same provider-first flow
- `/provider groq`    -> jump straight to a specific provider's model picker
- `/model gemma`      -> filter: if 1 match it switches instantly; if many, shows a short menu
- `/model gpt-4o`     -> exact/unique match, switches directly
- `/model groq/gpt-oss-20b` -> provider-scoped switch (model ids may contain `/`)
- `/model <partial>`  -> Tab completes provider/model ids while typing
- Type `0` or press Enter on an empty prompt to cancel a menu
- Model menus show a `[tools ✓]` tag when the model supports tool calling

Other REPL commands:

| Command | What it does |
|---------|--------------|
| `/model` | Open model menu / show current |
| `/provider` | Pick a provider, then a model from it |
| `/permissions` | Show tool permissions (allow/ask/deny) |
| `/config` | Open config file in editor |
| `/clear` | Reset conversation history |
| `/sessions` | List saved sessions |
| `/load <id>` | Resume a saved session |
| `/save <name>` | Save current conversation |
| `/undo` | Remove last assistant turn |
| `/help` | Show all commands |
| `/exit` or `/quit` | Quit |

Tip: end a line with `\` to continue typing on the next line (multiline input).

---

## 4. Model IDs and providers

Model ids look like `provider/model`, e.g. `openrouter/openai/gpt-4o`.

Free models (no credit cost) are marked `[free]` / `:free` suffix:

- `openrouter/free`                    — free auto router (good default)
- `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`
- `openrouter/nvidia/nemotron-3-super-120b-a12b:free`
- `openrouter/google/gemma-4-26b-a4b-it:free`
- many more — run `myagent --list-models`

Providers shown by `myagent --providers`:

| Provider | Key env var | Base URL |
|----------|-------------|----------|
| openrouter | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` |
| openai | `OPENAI_API_KEY` | `https://api.openai.com/v1` |
| google | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | `.../generativelanguage.googleapis.com/v1beta/openai` |
| xai | `XAI_API_KEY` | `https://api.x.ai/v1` |
| anthropic | `ANTHROPIC_API_KEY` | `https://api.anthropic.com/v1` |
| groq | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` |
| mistral | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` |
| zai | `ZAI_API_KEY` | `https://api.z.ai/api/paas/v4` |
| huggingface | `HF_TOKEN` (or `HUGGINGFACE_TOKEN`) | `https://router.huggingface.co/v1` |

Each provider is **isolated**: its own key, models, discovery, cache, and error policy — there is
**no silent fallback** to another provider. `--providers` shows `✓ configured` / `✗ missing` per slot.

### Free providers for students (no credit card)

These have permanent / generous free tiers that work directly with myagent (all OpenAI-compatible):

**Groq** — free forever, no card needed. Very fast (LPU hardware).
- Sign up: <https://console.groq.com> → API Keys → copy key.
- Set `GROQ_API_KEY=...` in your `.env`.
- Good free models (verified live Sep 2026):
  - `groq/openai/gpt-oss-120b` and `groq/openai/gpt-oss-20b` — GPT-class
  - `groq/qwen/qwen3.8-27b` and `groq/qwen/qwen3.6-27b` — Qwen 27B
  - Free limits approx: ~30 req/min, up to ~14,400 req/day.
  - Note: older `groq/llama-*` ids like `llama-3.3-70b-versatile` no longer exist — use `--list-models`
    or the `/model` menu to see current real ids.

**Mistral** — ~1 billion tokens per month free (resets monthly). Phone number verification required,
no card. Free tier is 2 requests/minute — myagent retries transiently, so occasional bursts are fine.
- Sign up: <https://console.mistral.ai> → API keys → copy key.
- Set `MISTRAL_API_KEY=...` in your `.env`.
- Good free models (verified live Sep 2026):
  - `mistral/codestral-latest` — code-focused
  - `mistral/mistral-small-2603` / `mistral/mistral-small-latest`
  - `mistral/mistral-medium-2604`, `mistral/ministral-8b-latest`

**Google Gemini** — free tier via AI Studio (no card):
- <https://aistudio.google.com/apikey> → `GEMINI_API_KEY`.
- Models: `google/gemini-3.8-flash`, `google/gemini-3.7-flash`, `google/gemini-3.6-flash`,
  `google/gemini-3.5-flash`.

**Z.ai (GLM)** — free daily quota:
- <https://www.z.ai> → API keys → `ZAI_API_KEY`.
- Models: `zai/glm-5.3-flash`, `zai/glm-5.3`, `zai/glm-5.2`, `zai/glm-5`, `zai/glm-4.5`, ...
- ⚠ Activation: claim a **free Resource Package** at platform.z.ai first, or the API returns
  `Insufficient balance or no resource package` (HTTP 429, code 1113).

**Hugging Face** — router over HF-hosted models:
- <https://huggingface.co/settings/tokens> → `HF_TOKEN`.
- Models: `huggingface/Qwen/Qwen3-30B-A3B`, `huggingface/meta-llama/Llama-3.1-8B-Instruct`,
  `huggingface/mistralai/Mistral-7B-Instruct-v0.3`, and ~140 more (auto-listed).

**OpenRouter** — 25+ `:free` models and the `openrouter/free` auto-router work even with $0 balance.

Examples:

```bash
myagent -m groq/openai/gpt-oss-20b "explain the code in src/"
myagent -m mistral/codestral-latest "write a palindrome checker"
myagent -m zai/glm-5.3-flash "hello"
myagent -m huggingface/Qwen/Qwen3-30B-A3B "summarize README.md"
```

---

## 5. Credits / balance (important!)

- Your default model is your choice. If it is a **paid** model (like `gpt-4o`) and your
  OpenRouter account is on the **free tier** with no credits, requests get rejected
  with a **402 "This request requires more credits"** error.
- This is NOT a bug and NOT caused by usage. It is just "not enough balance for the
  requested output budget".
- myagent handles it automatically: it retries with fewer output tokens
  (`max_tokens` 4096 -> 2048 -> ...), so small tasks still succeed. You will see a
  small hint: `⤷ small balance — retrying with fewer output tokens (…)`.
- To avoid the credit warnings entirely, use a **free** model:
  `myagent -m openrouter/free` (or pick one in the model menu).
- When your balance is genuinely low, a one-time warning shows at startup
  (warn < $1, critical < $0.10).
- Balance check happens against `https://openrouter.ai/api/v1/auth/key`.

---

## 6. Tools the agent can use

The agent writes real files, runs commands, and reads/searchs your codebase:

- read, write, edit files (edits must match existing content, like a diff)
- run terminal commands (bash / PowerShell)
- grep / glob search across the project (uses `rg` if available, falls back to a
  Node implementation)
- `apply_patch` for applying unified-diff patches

Permissions are shown with `/permissions` and edited in the config file (`allow`,
`ask`, or `deny` per tool).

---

## 7. Sessions

- Conversations are auto-saved after every turn.
- `/save custom-name` -> `custom-name` session.
- `/sessions` -> list; `/load <id>` -> resume.
- Saved sessions live in `~/.myagent/sessions/`.

---

## 8. Environment knobs

| Variable | Effect |
|----------|--------|
| `MYAGENT_CWD` | working directory (also `--cwd`) |
| `MYAGENT_NO_RG` | force Node grep even if `rg` is installed |
| `MYAGENT_BALANCE_WARN` | balance threshold to warn (default `1.0`) |
| `MYAGENT_BALANCE_CRITICAL` | critical threshold (default `0.10`) |
| `NO_COLOR` | disable color |
| `EDITOR` | editor for `/config` (default notepad on Windows) |

---

## 9. URLs / references

- Credits: <https://openrouter.ai/settings/credits>
- OpenRouter keys: `.env` or <https://openrouter.ai/keys>

---

## 10. Troubleshooting

**"No API key for provider"** — add the matching env var from section 4 to
`.env` (myagent folder or `~/.myagent/.env`). `myagent --providers` shows `✗ missing` for unset slots.

**"No API key for provider \"OpenAI\""** — OpenAI, xAI and Anthropic are placeholders until you add
their keys; every other provider reads **only its own** env var (no fallback chains).

**"This request requires more credits"** — free-tier balance. Use `openrouter/free`
or `:free` models, or add paid credits. myagent auto-lowers output tokens, so this
often resolves itself for small tasks.

**Rate limited (429)** — providers like Mistral's free tier (2 RPM) throttle bursts. myagent retries
up to 3× with backoff (1s→2s→4s), then shows the reason with provider+model context. Wait a minute
and retry, or `/model` to another provider.

**Insufficient credits / quota on Z.ai** — you need to claim a free **Resource Package** for `glm-*`
at platform.z.ai before the API key works.

**Request failed and the REPL shows a menu** — `[R] try again`, `[M] another model`,
`[P] another provider`, `[X] exit`. Your unanswered prompt is preserved for retry.

**Model set not kept** — `/model` changes the model for the current session only.
To make it permanent, edit `model` in `~/.myagent/config.json`.

**Windows pipe quirks** — piping multiple lines into the REPL can merge them into
one input. For scripts, use one command per line; the model menu is numbered, so it
works fine with piped input too.

**Arrow keys don't move the menu** — the menu intentionally uses typing numbers,
not arrow keys, so it works in any terminal (including cmd/PowerShell/Windows Terminal).

---

## 11. Student tricks — how to use myagent like a pro (and save tokens)

### 11.1 Pick the right model for the job (never pay for what a free model can do)

| Need | Best pick | Why |
|---|---|---|
| Quick question / chat | `groq/openai/gpt-oss-20b` or `google/gemini-3.7-flash` | fast, tiny latency, near-zero cost on free tier |
| Coding / C++ / algorithms | `mistral/codestral-latest` | trained on code |
| Big context / research | `google/gemini-3.8-flash` | large context, cheap speed |
| Cost-aware long tasks | `huggingface/Qwen/Qwen3-30B-A3B` | 140+ HF models, monthly credits |
| Bull work / many calls | `groq/qwen/qwen3.8-27b` | groq is effectively unlimited free |

Rule of thumb: **use the smallest model that can do the job.** A 1-line task on a 120B
model wastes tokens and money. Switch with `/model <id>` — it's instant.

### 11.2 Token economy — 10 concrete ways to spend less

1. **Shorter prompts = fewer input tokens.** Instead of pasting a full file, point at it:
   `myagent "explain the CashFlow class in src/accounting.js"`. The agent reads only what it needs.
2. **Ask for minimal output.** Add `— answer in 3 bullet points` / `return only the code` /
   `no explanation`. Output tokens cost the same as input on most providers. This is the #1 saver.
3. **Keep conversations short.** Every REPL turn resends the whole history. Unrelated task?
   `/clear` immediately. A fresh chat costs ~100 tokens; a 30-turn chat costs thousands per turn.
4. **Prefer one-shot mode for small questions.** `myagent "..."` starts with a clean slate —
   no REPL history accumulating.
5. **Use `\` multiline only for the big prompts.** Concise one-liners are usually enough.
6. **Do the grunt work yourself when 100% mechanical** (renaming 20 vars, formatting) — let the
   agent do the thinking, not the typing.
7. **Batch related questions in ONE session** on the same topic — context reuse pays off (history
   is one cost, many answers).
8. **Set `agent.maxTokens` modestly in config** for your default model (e.g. 1024) and raise it
   only when a task truly needs a long answer. Fewer tokens per failed 402-shrink attempt too.
9. **`--cwd` to the project folder** — the agent grep/globs a narrower tree, faster + cheaper.
10. **Be explicit about files.** "edit src/app.js: change line 42 to X" avoids the agent
    reading 5 files to guess what you meant.

### 11.3 Free-tier "dashboard" (know your limits before they bite)

| Provider | Free ceiling | Tool to check |
|---|---|---|
| Mistral | ~1B tokens/month, **2 req/min** | their console "Usage" tab |
| Groq | ~14.4k req/day small models | console |
| Gemini | Flash ~1,500 req/day | AI Studio quota page |
| Z.ai | ~1,000 req/day | platform.z.ai |
| Hugging Face | monthly credits | HF settings |
| OpenRouter | 25+ `:free` models at $0 | `myagent --providers` + model menu |

Because myagent retries transiently (1s→2s→4s) and **never silently switches providers**, a
rate-limit on Groq does NOT mean it borrows Mistral's quota. You always know who's throttling you.

### 11.4 Rotate providers to multiply your free quota

You effectively get the **sum** of all these free tiers. When one throttles:

- `[P]` in the recovery menu → switch provider instantly (or `/provider <id>`).
- Keep a "fast" provider (groq) and a "deep" provider (mistral/gemini) as your two default routes.
- Heavy days: spread the load — morning on gemini, afternoon on groq, evening on mistral.

---

## 12. Emergency: "my free limit suddenly ran out" — 5-minute recovery

Your provider says `Insufficient credits`, `Rate limited`, or a daily cap hit mid-task. **Do this:**

### Step 1 — don't lose your work

1. Your prompt is preserved: hit `[R]` once later, or the REPL shows the issue first.
2. `/save rescue-20260905` right now — session saved to disk, nothing lost.

### Step 2 — flip to a provider that still has quota (10 seconds)

- `[P] another provider` in the recovery menu, or `/provider groq` → pick a fresh model.
- Or exit and start with: `myagent -m groq/openai/gpt-oss-20b` (far quota) or
  `myagent -m google/gemini-3.7-flash` (daily reset).
- Expect **one** clean error message with the reason + provider/model name — no silent fallback,
  no mystery.

### Step 3 — if OpenRouter credits ran out specifically

- Free tiers need **no OpenRouter credits at all**: switch to any `groq/`, `mistral/`, `google/`,
  `zai/`, or `huggingface/` model. The `402 — more credits` shrink already retried with a smaller
  budget first; those direct providers are your zero-cost option.
- Want OpenRouter back? Use `:free` models (`openrouter/free`, `...-inst:free`) which work at $0.

### Step 4 — if EVERYTHING is throttled (unusual)

All 5 free providers won't be down at once. When they are:

1. Wait for the reset: most free ceilings reset **daily at midnight UTC** or per-minute (Mistral 2
   RPM). Wait it out or schedule heavy work for after reset.
2. Reduce burst: add a pause between requests. For scripts, one command per line (Windows pipe
   quirk) also naturally spaces calls.
3. Lower the answer size: add `— max 100 words` to prompts so 402-shrink/limits matter less.
4. Last resort: `openrouter/free` — still free and routed through OpenRouter's pool.

### Step 5 — long-term insurance (student edition)

- **Keep all 5 keys in `.env`** — free, 10 minutes of setup, 5× the quota.
- Set a **cheap default** in `~/.myagent/config.json`:
  `"model": "groq/openai/gpt-oss-20b"` so every accidental `myagent` run costs nothing.
- Re-run `myagent --providers` occasionally to catch a dead key before you need it.
- Big exams/assignments: test the preview on `gpt-oss-20b`, then do the final full run on
  `codestral-latest` — same file edits are cheap to redo if the first attempt was wasted tokens.