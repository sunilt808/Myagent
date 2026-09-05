const readline = require("readline");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { loadConfig, saveConfig, CONFIG_PATH } = require("./config");
const { listModels, resolveModel, getModelById, setDefaultModel } = require("./models");
const { runAgent, formatError } = require("./agent");
const crypto = require("crypto");
const ui = require("./ui");
const { configPath } = require("./models");

const BANNER = ui.green(`
   ███╗   ███╗██╗   ██╗ █████╗  ██████╗ ███████╗███╗   ██╗████████╗
   ████╗ ████║╚██╗ ██╔╝██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
   ██╔████╔██║ ╚████╔╝ ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║
   ██║╚██╔╝██║  ╚██╔╝  ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║
   ██║ ╚═╝ ██║   ██║   ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║
   ╚═╝     ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝
`);

function makeSessionStore() {
  const dir = path.join(os.homedir(), ".myagent", "sessions");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listSessions() {
  const dir = makeSessionStore();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      try {
        const data = JSON.parse(fs.readFileSync(full, "utf8"));
        return { id: f.replace(".json", ""), title: data.title || "Untitled", size: stat.size, mtime: stat.mtime };
      } catch {
        return { id: f.replace(".json", ""), title: "Untitled", size: stat.size, mtime: stat.mtime };
      }
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function loadSession(id) {
  const full = path.join(makeSessionStore(), `${id}.json`);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function saveSession(id, session) {
  const full = path.join(makeSessionStore(), `${id}.json`);
  fs.writeFileSync(full, JSON.stringify(session, null, 2));
}

function newSessionId() {
  return "sess-" + crypto.randomBytes(4).toString("hex");
}

function printHelp() {
  ui.log(ui.dim("  Commands:"));
  ui.log(ui.dim("    /models             open the numbered model menu"));
  ui.log(ui.dim("    /model <name>       filter + pick, e.g. /model gemma  (>1 match shows menu)"));
  ui.log(ui.dim("                        /model gpt-4o  switches directly"));
  ui.log(ui.dim("                        /model         opens the full menu"));
  ui.log(ui.dim("                        Tab completes a partial provider/model id"));
  ui.log(ui.dim("    /permissions        show/edit tool permissions"));
  ui.log(ui.dim("    /config             open the config file (creates defaults first)"));
  ui.log(ui.dim("    /clear              clear conversation history"));
  ui.log(ui.dim("    /sessions           list saved sessions"));
  ui.log(ui.dim("    /load <id>          load a previous session"));
  ui.log(ui.dim("    /save <name>        save current session under a name"));
  ui.log(ui.dim("    /undo               remove the last assistant turn"));
  ui.log(ui.dim("    /help               show this help"));
  ui.log(ui.dim("    /exit, /quit, Ctrl+C  exit"));
  ui.log(ui.dim(""));
  ui.log(ui.dim("  Tip: end a line with \\ to continue on the next line (multiline prompts)."));
}

// Case-insensitive substring match across id, name, and raw model id.
function findMatchingModels(modelList, term) {
  const t = String(term || "").trim().toLowerCase();
  if (!t) return [];
  return modelList.filter(
    (m) =>
      m.id.toLowerCase().includes(t) ||
      (m.name || "").toLowerCase().includes(t) ||
      String(m.model).toLowerCase().includes(t)
  );
}

// Numbered model menu. Optionally filters to `filterText` matches first.
// Works everywhere (CLI, pipe, scripts) — no arrow keys required.
function modelMenu(rl, modelList, currentId, filterText) {
  return new Promise((resolve) => {
    let list = modelList;
    if (filterText) {
      list = findMatchingModels(modelList, filterText);
    }
    if (list.length === 1) return resolve(list[0]);
    if (list.length === 0) {
      ui.log(ui.red(`  No models match "${filterText}".`));
      return resolve(null);
    }

    const providerGroups = {};
    for (const m of list) {
      if (!providerGroups[m.provider]) providerGroups[m.provider] = [];
      providerGroups[m.provider].push(m);
    }
    const flat = [];
    ui.log("");
    ui.log(
      ui.cyan(ui.bold(`  Select a model${filterText ? ` (filter: ${filterText})` : ""} — number, or id/name; 0 = cancel`))
    );
    for (const [pkey, models] of Object.entries(providerGroups)) {
      ui.log(ui.yellow(ui.bold(`  ${pkey.toUpperCase()}`)));
      for (const m of models) {
        const idx = flat.length;
        flat.push(m);
        const freeTag = m.category === "free" || /:free$/.test(m.model) ? ui.green(" [free]") : "";
        const curTag = m.id === currentId ? ui.dim("  ◀ current") : "";
        ui.log(`    ${String(idx + 1).padStart(2)}. ${ui.cyan(m.name)}${freeTag}  ${ui.gray(m.id)}${curTag}`);
      }
    }
    ui.log("");
    rl.question(ui.dim("  Pick a number (or id/name, 0 = cancel) > "), (line) => {
      const answer = line.trim();
      const low = answer.toLowerCase();
      if (!answer || answer === "0") return resolve(null);
      const asNum = parseInt(answer, 10);
      if (!isNaN(asNum) && asNum >= 1 && asNum <= flat.length) return resolve(flat[asNum - 1]);
      const exact = list.find((m) => m.id.toLowerCase() === low || (m.name || "").toLowerCase() === low || m.model.toLowerCase() === low);
      if (exact) return resolve(exact);
      const partial = findMatchingModels(list, low);
      if (partial.length === 1) return resolve(partial[0]);
      ui.log(ui.red(`  No model matched "${answer}".`));
      resolve(null);
    });
  });
}

function showPermissions(config) {
  ui.log("");
  ui.log(ui.bold("  Tool permissions"));
  for (const [tool, perm] of Object.entries(config.permissions)) {
    const color = perm === "allow" ? ui.green : perm === "ask" ? ui.yellow : ui.red;
    ui.log(`  ${tool.padEnd(14)} ${color(perm)}`);
  }
  ui.log(ui.dim("  Edit " + CONFIG_PATH + " to change defaults."));
}

async function handleCommand(rl, line, state) {
  const [cmd, ...rest] = line.slice(1).trim().split(/\s+/);
  const arg = rest.join(" ");
  const config = loadConfig();

  switch (cmd) {
    case "help":
    case "?":
      printHelp();
      return true;
    case "exit":
    case "quit":
      ui.log(ui.dim("Bye!"));
      process.exit(0);
      break;
    case "models":
    case "model":
      {
        const models = listModels(config);
        if (!arg) {
          ui.log("");
          ui.log(ui.bold("  Current model: ") + ui.cyan(state.model.id));
          const picked = await modelMenu(rl, models, state.model.id, "");
          if (!picked) return true;
          state.model = picked;
          ui.log(ui.green(`  → Model set to ${picked.id}`));
          return true;
        }
        // Exact catalog id, or a bare model name (e.g. "gpt-4o", "gemma").
        let found = getModelById(config, arg);
        if (found) {
          state.model = found;
          ui.log(ui.green(`  → Model set to ${found.id}`));
          return true;
        }
        // Partial / fuzzy match: unique result applies directly, otherwise prompt.
        const matches = findMatchingModels(models, arg);
        if (matches.length === 1) {
          state.model = matches[0];
          ui.log(ui.yellow(`  ${arg} matched ${ui.bold(matches[0].id)} — set.`));
          ui.log(ui.green(`  → Model set to ${matches[0].id}`));
          return true;
        }
        if (matches.length > 1) {
          const picked = await modelMenu(rl, models, state.model.id, arg);
          if (!picked) return true;
          state.model = picked;
          ui.log(ui.green(`  → Model set to ${picked.id}`));
          return true;
        }
        // No catalog match: allow raw/provider-prefixed ids (e.g. a brand-new model).
        if (String(arg).includes("/")) {
          found = resolveModel(config, arg);
          ui.log(ui.yellow(`  ${arg} is not in the catalog — using it as a raw id.`));
          state.model = found;
          ui.log(ui.green(`  → Model set to ${found.id}`));
          return true;
        }
        ui.log(ui.red(`  Unknown model: ${arg}. Try /model <partial name> (e.g. /model gemma) or /model to browse.`));
      }
      return true;
    case "permissions":
      showPermissions(config);
      return true;
    case "config":
      saveConfig(config);
      ui.log(ui.dim(`  Config path: ${CONFIG_PATH}`));
      ui.log(ui.dim("  Opening in editor..."));
      const editor = process.env.EDITOR || (process.platform === "win32" ? "notepad" : "vi");
      try {
        const { spawn } = require("child_process");
        const child = spawn(editor, [CONFIG_PATH], { stdio: "inherit", windowsHide: true });
        await new Promise((r) => child.on("exit", r));
        ui.log(ui.green("  Config saved. Restart or run /model to apply changes."));
      } catch (err) {
        ui.log(ui.red(`  Failed to open editor: ${err.message}`));
      }
      return true;
    case "clear":
      state.messages = [];
      ui.log(ui.dim("  Conversation cleared."));
      return true;
    case "undo":
      for (let i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i].role === "assistant") {
          state.messages.splice(i);
          ui.log(ui.dim(`  Removed assistant turn (${state.messages.length} messages left).`));
          return true;
        }
      }
      ui.log(ui.dim("  Nothing to undo."));
      return true;
    case "sessions":
      {
        const sessions = listSessions();
        ui.log("");
        if (!sessions.length) {
          ui.log(ui.dim("  No saved sessions yet."));
        } else {
          for (const s of sessions.slice(0, 15)) {
            ui.log(`  ${ui.cyan(s.id)}  ${ui.bold(s.title || "")}  ${ui.gray(s.mtime.toLocaleString())}`);
          }
        }
      }
      return true;
    case "load":
      {
        const id = arg || "";
        const s = loadSession(id);
        if (!s) {
          ui.log(ui.red(`  Session ${id} not found. Use /sessions to list.`));
          return true;
        }
        state.messages = s.messages || [];
        state.sessionId = s.id;
        state.model = s.model || state.model;
        ui.log(ui.green(`  Loaded session "${s.title || s.id}" (${state.messages.length} messages).`));
      }
      return true;
    case "save":
      {
        const id = (arg || "sess-" + crypto.randomBytes(4).toString("hex")).replace(/\.json$/, "");
        const s = { id, title: generateTitle(state.messages) || arg || "Untitled", messages: state.messages, model: state.model };
        saveSession(id, s);
        state.sessionId = id;
        ui.log(ui.green(`  Saved session as ${id}`));
      }
      return true;
    default:
      ui.log(ui.red(`  Unknown command: /${cmd}. Try /help`));
      return true;
  }
}

function generateTitle(messages) {
  const first = messages.find((m) => m.role === "user");
  if (!first || typeof first.content !== "string") return "";
  return first.content.replace(/\s+/g, " ").slice(0, 48);
}

async function repl({ initialModel, cwd, verbose, noBanner }) {
  if (!noBanner) {
    ui.log(BANNER);
    ui.log(ui.dim(`  cwd: ${cwd}`));
  }
  const config = loadConfig();
  const state = {
    model: getModelById(config, initialModel) || resolveModel(config, initialModel),
    messages: [],
    sessionId: newSessionId(),
    history: []
  };
  ui.log(ui.dim(`  model: ${state.model.id}  (${ui.cyan(state.model.name)})`));
  ui.log(ui.dim("  type /help for commands · /model or /models opens the model menu · Tab completes model ids · end a line with \\ for multiline"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    completer: (line) => {
      // Tab-complete /model and /models with catalog ids and provider prefixes.
      const m = line.match(/^\/models?\s+(\S*)$/i);
      if (!m) return [[], line];
      const prefix = m[1].toLowerCase();
      const ids = listModels(loadConfig()).map((x) => `${x.provider}/${x.model}`);
      const hits = [...new Set(ids)].filter((id) => id.toLowerCase().startsWith(prefix)).slice(0, 40);
      return [hits, prefix];
    }
  });

  const MAX_SAVE = 20;
  function keepHistory(line) {
    state.history.push(line);
    if (state.history.length > MAX_SAVE) state.history.shift();
    rl.setPrompt(ui.cyan("  you > "));
  }

  async function promptUser() {
    if (closed) return undefined;
    return new Promise((resolve) => {
      pending = resolve;
      rl.question(ui.cyan("  you > "), (line) => {
        pending = null;
        resolve(line);
      });
    });
  }

  let closed = false;
  let pending = null;
  rl.on("close", () => {
    closed = true;
    if (pending) {
      const p = pending;
      pending = null;
      p(undefined);
    }
  });

  rl.setPrompt(ui.cyan("  you > "));
  rl.on("SIGINT", () => {
    ui.log(ui.dim("\n  (Ctrl+C) use /exit to quit, or keep going."));
    rl.prompt();
  });

  while (true) {
    let first = await promptUser();
    if (first === undefined) {
      ui.log(ui.dim("Bye!"));
      process.exit(0);
    }
    first = first.trim();
    if (!first) continue;
    if (first.startsWith("/")) {
      await handleCommand(rl, first, state);
      continue;
    }
    let parts = [first];
    while (first.endsWith("\\")) {
      const next = await promptUser();
      if (next === undefined || next.trim() === "") break;
      parts.push(next.trim());
      first = (parts[parts.length - 2] || "") + " " + next.trim();
    }
    const prompt = parts
      .join("\n")
      .replace(/\\$/, "");

    if (verbose)
      ui.log(ui.dim(`\n  ${state.model.id} → `));

    state.messages.push({ role: "user", content: prompt });
    ui.log(ui.dim("\n  ── assistant ──"));
    try {
      let fullText = "";
      const result = await runAgent({
        model: state.model.id,
        messages: state.messages,
        config,
        cwd,
        verbose,
        onText: (t) => {
          process.stdout.write(t);
          fullText += t;
        }
      });
      process.stdout.write("\n");
      if (fullText && fullText.trim()) {
        state.messages = result.history;
        state.messages.push({ role: "assistant", content: fullText });
      } else {
        state.messages = result.history;
      }
      autoSave(state);
    } catch (err) {
      ui.log(ui.red("\n  ⚠ " + formatError(err)));
      state.messages.pop();
    }
  }
}

function autoSave(state) {
  const s = {
    id: state.sessionId,
    title: generateTitle(state.messages) || "Untitled",
    messages: state.messages,
    model: state.model
  };
  saveSession(s.id, s);
}

module.exports = { repl, listSessions, loadSession, saveSession, newSessionId, BANNER, modelMenu, findMatchingModels };