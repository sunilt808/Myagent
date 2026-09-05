# myagent — terminal AI coding agent

A small, self-contained CLI coding agent that runs anywhere on your PC. It talks to
hosted model APIs (no local models, no Ollama), supports manual model selection, and
can read/write files and run shell commands when you approve them.

Built because the RooCode VS Code extension started failing; this tool is
OpenCode-CLI-style but with your own key and manual model control.

---

## 1. Install

Requirements: Node.js 18+ (developed on Node 22). One API key (OpenRouter is the default
and is the only one needed to get started).

Global install (so you can run `myagent` from any folder):

```powershell
cd C:\Users\sunil\myagent
npm link
```

If `npm link` is not available on your system, install the package globally instead:

```powershell
npm install -g .
```

### API key(s)

Secrets are read from `.env`, checked in this order (first match wins — real
environment variables always win):

1. Your current shell environment
2. `.env` in the folder you are running from
3. `.env` in the myagent project folder
4. `~/.myagent/.env`

Edit the project `.env` (already contains `OPENROUTER_API_KEY`). You can also add keys
for direct OpenAI / Google Gemini / xAI / Anthropic access:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
# OPENAI_API_KEY=
# GEMINI_API_KEY=          # you said you have a Gemini Pro key
# XAI_API_KEY=
# ANTHROPIC_API_KEY=
```

> Never commit your `.env` to a repo or paste keys into chat/screenshots.

---

## 2. Quick start

```powershell
myagent                        # interactive chat (REPL) in the current folder
myagent "write a hello world and run it"
myagent -m openrouter/nvidia/nemotron-3-super-120b-a12b:free "theme?"
myagent --list-models          # show every model id in the catalog
myagent --providers            # registered providers + key status
```

Every run pays attention to the current folder. Use `--cwd <dir>` to point the agent at
another project.

---

## 3. Choosing a model (manually)

The whole point of this tool is that *you* pick the model.

| How | Example |
|---|---|
| CLI flag (single-shot) | `myagent -m openrouter/openai/gpt-6-astra "..."` |
| CLI flag (REPL) | `myagent -m openrouter/anthropic/claude-fable-5.1` |
| In-session switch | `/model openrouter/qwen/qwen3-coder` |
| Interactive picker | `/models` |
| Show current | `/model` |
| Make permanent | `myagent -m <id>` writes the default into `~/.myagent/config.json` |

### Model ID format

`<provider>/<slug>`. For OpenRouter models the slug is everything after `openrouter/`
and usually mirrors the route on openrouter.ai, e.g.:

```
openrouter/openai/gpt-6-astra
openrouter/nvidia/nemotron-3-super-120b-a12b:free
openrouter/google/gemini-3.8-flash
openrouter/liquid/lfm-2.5-2.6b:free
```

The special router `openrouter/free` auto-picks a free model from OpenRouter's pool.

### Catalog

The catalog lives in `src/config.js` (`DEFAULT_PROVIDERS`). To add or override a model,
add an entry like `"vendor/model-id": { "name": "Friendly name", "category": "free" }`
under `provider.<name>.models` in `~/.myagent/config.json` (the config file is merged
over the code catalog, so you can also change names/categories).

Current catalog (verified live on the OpenRouter key, Sep 2026):

- Free: `openrouter/free`, Nemotron 3 Ultra / Super / Nano-Omni / 3.5 Lightning,
  Gemma 4 26B (flaky), Laguna S 2.1, North Mini Code, MiniMax M2.7, Dots 3 Note,
  Ling 3.0 Flash, LFM 2.5 2.6B
- Paid (OpenRouter): GPT-6 Astra, GPT-5.6 Sol/Terra/Luna, GPT-5.1, GPT-5.1 Codex,
  GPT-4o(+mini), Claude Fable 5.1 / Sonnet 5 / Opus 5 / 4.6 Sonnet / Sonnet 4,
  Gemini 3.8/3.7/3.6/3.5 Flash, Grok 4.6/4.5/4.20 Beta, DeepSeek V4 Pro/Flash, Chat,
  Qwen 3.8 Max/Flash, Qwen 3 Coder, Microsoft Phi-4, GLM 5.3 Flash, Llama 4 Maverick/Scout,
  Llama 3.3 70B

Notes on the catalog:

- Free tier changes monthly; several `.free` routes have become paid or been removed
  (gpt-oss, qwen3-coder:free, kimi-k2.6, llama-3.3:free among others). Re-run the smoke
  test (section 9) to find dead entries.
- `microsoft/mai-thinking-1` and `microsoft/mai-code-1*` were checked — they are **not
  yet public on OpenRouter** (currently private preview via Microsoft Foundry / GitHub
  Copilot). Only `microsoft/phi-4` is live there right now.
- `openai/`, `google/`, `xai/`, `anthropic/` entries are templates for direct keys; they
  skip until you set the matching env var.

---

## 4. Usage modes: research & coding

### 4.1 Coding mode

Point the agent at a project and give it a task. It uses `read`/`glob`/`grep` to explore
(allow), then `write`/`edit`/`bash` (ask — approve each mutation):

```powershell
myagent --cwd C:\path\to\project "add a /health endpoint to server.js and run the tests"
```

Work interactively for multi-step tasks so you can approve tool calls as they come:

```powershell
myagent -m openrouter/anthropic/claude-fable-5.1      # strong reasoning
```

Recommended coding models (verified working): `claude-fable-5.1`, `claude-sonnet-5`,
`gpt-6-astra`, `gpt-5.1-codex`, `qwen3-coder`, `deepseek-v4-flash`, `grok-4.5`,
`laguna-s-2.1:free` (fast free option).

### 4.2 Research mode

The agent can *view* anything but can't mutate without your say-so, so a research pass
is safe read-only exploration:

```powershell
myagent -m openrouter/google/gemini-3.8-flash "summarize how the auth module works, list every exported function and any security issues"
myagent "compare these two files line by line" --cwd C:\src
```

- `read` / `glob` / `grep` / `list` are auto-allowed (no prompts, no mutations).
- `webfetch` prompts you, so the agent can pull docs/APIs when you approve.
- For deep multi-file analysis the REPL (with `/permissions`) lets you allow tools once
  and keep the conversation going.

Recommended research models: `gemini-3.8-flash` (fast, big context), `gpt-6-astra`,
`claude-sonnet-5`, `deepseek-v4-pro`, `glm-5.3-flash`.

### 4.3 Pro tip: switch models per task

Because `/model` is instant, treat the model like a selector rail:

```text
/models                # pick once
/model gpt-5.1-codex   # coding
/model gemini-3.8-flash# research
/model nemotron-3-super-120b-a12b:free  # cheap free pass
```

---

## 5. Architecture

### 4.1 File layout

```
index.js              CLI entry (commander) → single-shot or REPL, env/balance bootstrap
src/config.js         provider/model catalog, config load/save (diff-based)
src/models.js         model id parsing, resolution, api key lookup
src/agent.js          streaming agent loop (send → tool calls → continue)
src/tools.js          file/bash/search tool implementations
src/permissions.js    allow/ask/deny rules per tool
src/repl.js           interactive shell, slash commands, sessions
src/ui.js             colors + pretty printing
src/balance.js        OpenRouter credit lookup + low-balance alert (added Sep 2026)
tools/test-models.js  smoke-test every catalog model
```

### 4.2 Request flow

1. You type a message (REPL) or pass it as an arg (single-shot).
2. `agent.js` opens a streaming chat to the chosen model (OpenAI-compatible client,
   `max_tokens` default 4096, timeout 180 s).
3. If the model calls a tool, the tool runs (subject to permissions, section 8) and its
   result is fed back; this repeats until the model gives a final answer or hits
   `agent.maxSteps` (30).
4. Streaming fragments are printed live.

### 4.3 Provider registry & model resolution

`src/config.js` holds `DEFAULT_PROVIDERS`, each with a `baseURL`, a lazy `apiKey()`
(getter that reads `process.env`), optional `defaultHeaders`, and a `models` map. The
code catalog is the single source of truth; the on-disk config (`~/.myagent/config.json`)
is deep-merged over it and stores only your diffs/overrides, so adding a model is just
an entry under `provider.<name>.models`.

`src/models.js` resolves any string you type into a model record:
- `parseModelId` splits `provider/slug`.
- `getModelById` matches against the merged catalog (by full id, provider+slug, or name).
- `resolveModel` falls back to constructing a "raw id" model record for any
  `provider/slug` string — so you can call routes that aren't yet listed in the catalog
  (the REPL warns "not in the catalog — will use it as a raw id").
- `getApiModelId` maps the special `openrouter/free` router correctly.
- `getApiKey` pulls the key from the provider's env var (injected at build time so the
  value only ever comes from the environment, never the file).

### 4.4 Tool calling loop

`agent.js` appends your message, requests a completion with tools, and if the model
returns `tool_calls` it executes each one via `src/tools.js` (through the permission
gate in `src/permissions.js`), appends the tool results, and calls the API again. This
continues until the model produces a normal assistant message or `maxSteps` is reached.
Verbose mode (`-v`) prints each `[tool] <name>` and any `(blocked)` decisions.

---

## 6. Config file

Location: `~/.myagent/config.json` (override with `--config-path` or `MYAGENT_CONFIG_DIR`).
It is kept deliberately small — the model catalog lives in code and the file only
records your overrides:

```jsonc
{
  "model": "openrouter/openai/gpt-4o",
  "provider": { "openrouter": { "models": { "vendor/model-id": { "name": "...", "category": "free" } } } },
  "permissions": {
    "bash": "ask", "read": "allow", "write": "ask", "edit": "ask",
    "glob": "allow", "grep": "allow", "list": "allow", "webfetch": "ask"
  },
  "agent": { "maxSteps": 30, "maxTokens": 4096, "temperature": null, "systemPrompt": null }
}
```

Tuning knobs:

- `agent.maxTokens` — big models like `openrouter/free` return HTTP 402 if this is set
  higher than your OpenRouter balance allows. 4096 fits a ~4000-token credit balance.
- `agent.maxSteps` — how many tool rounds before the agent must answer.
- `agent.systemPrompt` — override the built-in system prompt.
- `agent.temperature` — set to override the default (leave `null` for model default).

Re-create a fresh copy any time with `/config` (opens the file for editing).

---

## 7. Credit alert (replace-key warning)

`myagent` does **not** enforce any token/request limits on your usage. Its only
credit-related behavior is an alert so you know when to top up or swap `OPENROUTER_API_KEY`:

- On startup it checks the OpenRouter balance via `/api/v1/auth/key`.
- If your plan has a credit limit and the remaining balance drops below the warning
  threshold it prints `⚠ OpenRouter credits running low: $X left…`.
- Below the critical threshold (default $0.10) it prints a stronger alert telling you to
  top up at openrouter.ai or replace the key, and suggests using `:free` models meanwhile.
- The same alert is de-duplicated (max once per 6 hours) so it doesn't nag every run.
- On a real **HTTP 402 "out of credits"** error, the failure message is rewritten with a
  clear replace-key hint automatically.

Behavior is fully opt-in for configuration:

| Env var | Default | Meaning |
|---|---|---|
| `MYAGENT_BALANCE_WARN` | `1.0` | warn below this many `$` remaining |
| `MYAGENT_BALANCE_CRITICAL` | `0.10` | critical alert below this many `$` |

Accounts on the OpenRouter **free plan** (no credit limit) trigger no alert at all —
only genuine 402 "out of tokens" moments flag up, which is exactly the behavior you
asked for.

---

## 8. Tools & permissions

| Tool | Action | Default |
|---|---|---|
| `bash` | run a shell command (cmd / node / npm / etc., 30 s timeout) | ask |
| `read` | read a file (offset/limit, line-numbered) | allow |
| `write` | create/replace a file (creates parent dirs) | ask |
| `edit` | exact old-string → new-string replacement | ask |
| `apply_patch` | multi-file unified-diff patch (Add/Update/Delete/Move) | write-level |
| `glob` | find files by pattern | allow |
| `grep` | regex search (ripgrep if available, Node fallback) | allow |
| `list` | list a directory | allow |
| `glob_read` | read several matching files at once | allow |
| `webfetch` | fetch a URL and return its content | ask |

- In the interactive REPL you are prompted `Allow? (y/n/a)` — `a` remembers the choice
  for the rest of the session.
- In single-shot / piped mode (no TTY) `ask` tools are **auto-denied** so the agent never
  hangs waiting for input. You can run sessions with tool use inside the REPL instead.
- `bash` has a small safe-command whitelist (`COMMON_BASH_SAFE` in
  `src/permissions.js`) that is auto-allowed; anything else prompts.
- The prompt tells the agent to never print API keys and to treat `.env` as sensitive.

---

## 9. Testing models

```powershell
# every model in the catalog gets "Reply with exactly: OK" (plus 1.2 s spacing)
node tools/test-models.js <tag> [filter]
node tools/test-models.js all free      # only slugs containing "free"
```

Results are written to `tools/model-test-<tag>.json`. Read the verdict per model:
`ok` = answered "OK" · `reply` = answered something (route works) · `fail` = error.

The list is generated from `src/config.js`, so it always matches the catalog.

---

## 10. REPL reference

```
/models             list and pick a model (interactive)
/model <id>         switch model          /model (no arg) shows current
/permissions        view/edit tool permissions
/config             open config file
/clear              clear conversation history
/sessions           list saved sessions
/load <id>          reload a past session
/save <name>        save this session
/undo               drop the last assistant turn
/help               this help
/exit  /quit        quit (Ctrl+C also safe)
```

- Sessions are stored as JSON in `~/.myagent/sessions/`.
- End a line with `\` to continue on the next line (multiline prompts).
- Single-shot resume: `myagent -s <session-id> "continue..."`.

---

## 11. How to turn on full documentation / debugging

`myagent` ships with a verbose mode that logs everything the agent does:

```powershell
myagent -v "explain this repo"        # verbose single-shot
myagent -v                            # verbose REPL
```

With `-v` you see, live:
- each tool call as it happens (`[tool] <name>`),
- permission denials (`(blocked)`) and tool outputs,
- the raw model / system prompt used on each turn (REPL mode logs the full request).

Environment variables:

| Variable | Effect |
|---|---|
| `MYAGENT_CWD` | base folder for all tools (overrides `--cwd`) |
| `MYAGENT_CONFIG_DIR` | where `config.json` + sessions live (default `~/.myagent`) |
| `MYAGENT_NO_RG=1` | force the Node fallbacks for glob/grep (no ripgrep needed) |
| `NO_COLOR=1` | disable ANSI colors |

To see the actual HTTP conversation, `ruby`/`curl`-style debugging is not wired in, but
with `-v` the REPL prints the assembled messages array before each call — enough to see
exactly what the model received.

---

## 12. Known gaps & current bugs

- `apply_patch` handles simple unified diffs; exotic hunks (line-offset math, `\ No
  newline at end of file` markers) may fail. Use `write`/`edit` for tricky edits.
- `grep` needs ripgrep for speed; on machines without `rg` it falls back to a Node
  walker (set `MYAGENT_NO_RG=1`). It always skips `.git`, `node_modules`, `.myagent`.
- Free model availability drifts — re-run `tools/test-models.js` every few weeks.
- `openrouter/free` returns 402 if `maxTokens` exceeds your credit balance.
- A couple of free providers are flaky (Gemma 4 26B "Provider returned error"
  intermittently; Nvidia occasionally "Service temporarily overloaded").
- Non-TTY mode auto-denies `ask` tools by design (see section 8).
- `--providers` shows keys from `.env`; if you add keys to `~/.myagent/.env`, restart
  the terminal so the shell exports pick them up.