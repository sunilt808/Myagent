# myagent — User Guide

A terminal AI coding agent with manual model selection. Runs in your terminal as `myagent`.

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

- `/model`            -> full numbered menu, type a number to pick
- `/model gemma`      -> filter: if 1 match it switches instantly; if many, shows a short menu
- `/model gpt-4o`     -> exact/unique match, switches directly
- `/model <partial>`  -> Tab completes provider/model ids while typing
- Type `0` or press Enter on an empty prompt to cancel a menu

Other REPL commands:

| Command | What it does |
|---------|--------------|
| `/model` | Open model menu / show current |
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
| google | `GEMINI_API_KEY` | `.../generativelanguage.googleapis.com/v1beta/openai` |
| xai | `XAI_API_KEY` | `https://api.x.ai/v1` |
| anthropic | `ANTHROPIC_API_KEY` | `https://api.anthropic.com/v1` |

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
`.env` (myagent folder or `~/.myagent/.env`).

**"This request requires more credits"** — free-tier balance. Use `openrouter/free`
or `:free` models, or add paid credits. myagent auto-lowers output tokens, so this
often resolves itself for small tasks.

**Model set not kept** — `/model` changes the model for the current session only.
To make it permanent, edit `model` in `~/.myagent/config.json`.

**Windows pipe quirks** — piping multiple lines into the REPL can merge them into
one input. For scripts, use one command per line; the model menu is numbered, so it
works fine with piped input too.

**Arrow keys don't move the menu** — the menu intentionally uses typing numbers,
not arrow keys, so it works in any terminal (including cmd/PowerShell/Windows Terminal).