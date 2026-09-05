# myagent

A terminal AI coding agent with **manual, provider-first model selection**. Runs in any terminal
as `myagent` — interactive chat (REPL), one-shot queries, file editing, and shell commands with
permission prompts. Built because the RooCode VS Code extension kept failing; this is an
OpenCode-CLI-style tool with your own API keys and full control.

> **Last updated:** 2026-09-05 · Provider-isolation build (v1.1)
>
> See also: `docs/USE.md` (user guide) · `docs/DOCUMENTATION.md` (architecture) ·
> `docs/REVIEW-STATUS.md` (status) · `docs/api.txt` (free providers) · `result.txt` (test results).

---

## Quick start

```bash
myagent                            # interactive chat (REPL)
myagent "explain this file"        # one-shot
myagent -m groq/openai/gpt-oss-20b "run the tests"
myagent --list-models              # full model catalog
myagent --providers                # providers + key status
```

Requirements: **Node.js 18+** (developed on 22), one API key (OpenRouter or any provider in
`.env`). Install globally:

```bash
cd C:\Users\sunil\myagent
npm link          # (or: npm install -g .)
```

## Providers (hard isolation)

Every provider has its **own** credentials, model catalog, discovery, cache, and error policy.
There is **no silent cross-provider fallback** — a failure stays with its provider.

| Provider | Key var | Base URL | Free tier |
|---|---|---|---|
| OpenRouter | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` | 25+ `:free` models, $0 balance |
| Groq | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` | permanent free, no card |
| Mistral | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` | ~1B tokens/month (phone verify) |
| Google Gemini | `GEMINI_API_KEY` | `.../generativelanguage.googleapis.com/v1beta/openai` | generous daily free |
| Z.ai (GLM) | `ZAI_API_KEY` | `https://api.z.ai/api/paas/v4` | ~1,000 req/day (needs Resource Package) |
| Hugging Face | `HF_TOKEN` | `https://router.huggingface.co/v1` | free monthly credits |
| OpenAI / xAI / Anthropic | `OPENAI_API_KEY` / `XAI_API_KEY` / `ANTHROPIC_API_KEY` | official | — |

Paste keys into `.env` (myagent folder or `~/.myagent/.env`), then verify with `myagent --providers`.

## Choosing a model

- `/model` — provider-first picker (pick provider → pick model).
- `/model <id>` — direct switch, e.g. `/model groq/gpt-oss-20b` or `groq/qwen/qwen3.8-27b`.
- `/provider` or `/provider groq` — choose provider, then a model from it.
- `-m provider/model` — one-shot CLI flag.
- Model IDs split on the **first** slash: `groq/openai/gpt-oss-120b` → Groq, model `openai/gpt-oss-120b`.

Models are discovered live from each provider's `/models` endpoint (falling back to a curated
catalog), cached 24h in `~/.myagent/providers/<id>.json`.

## Error handling

- Errors are classified (auth / quota / not-found / rate-limit / timeout / server / network /
  capability) with provider + model context and a fix hint.
- Transient errors retry up to 3× with backoff (`404→408→429→5xx→network`); HTTP 402 shrinks the
  output budget (4096→256) automatically.
- If a request still fails, the REPL shows a recovery menu: `[R] try again · [M] another model ·
  [P] another provider · [X] exit` — the REPL never dies.

## Test summary (2026-09-05)

One coding question ("write `length_of_longest_substring(s)` in Python") sent to every configured
provider:

| Provider | Model | Result |
|---|---|---|
| Groq | `groq/openai/gpt-oss-20b` | ✅ code returned |
| Google Gemini | `google/gemini-3.7-flash` | ✅ code returned |
| Mistral | `mistral/codestral-latest` | ✅ code returned |
| Hugging Face | `huggingface/Qwen/Qwen3-30B-A3B` | ✅ code returned |
| Z.ai | `zai/glm-4.5` | ⚠ quota — activation pending (claim a **free Resource Package** at platform.z.ai) |

Full detail: `docs/provider-response-test.txt` and `result.txt`.

## Docs

- `docs/USE.md` — usage guide, commands, troubleshooting.
- `docs/DOCUMENTATION.md` — architecture, config, tools, permissions.
- `docs/REVIEW-STATUS.md` — model smoke tests, gap list.
- `docs/api.txt` — free API providers for students (no credit card).