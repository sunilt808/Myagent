#!/usr/bin/env node
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
dotenv.config({ quiet: true });
for (const p of [path.join(__dirname, ".env"), path.join(require("os").homedir(), ".myagent", ".env")])
  if (fs.existsSync(p)) dotenv.config({ path: p, quiet: true, override: false });

const { Command, Option } = require("commander");
const { loadConfig, saveConfig, CONFIG_PATH } = require("./src/config");
const { listModels, resolveModel, getModelById, setDefaultModel, getApiKey } = require("./src/models");
const { runAgent, formatError } = require("./src/agent");
const { repl, listSessions, loadSession } = require("./src/repl");
const { getBalance, balanceHints, wasAlreadyAlerted, markAlerted } = require("./src/balance");
const ui = require("./src/ui");

async function showBalanceAlert(config) {
  const orProvider = config.provider?.openrouter;
  if (!orProvider) return;
  const key = getApiKey(orProvider);
  if (!key) return;
  const balance = await getBalance(key);
  const hint = balanceHints(balance);
  if (!hint || hint.level === "ok") return;
  if (wasAlreadyAlerted(config, hint.level)) return;
  const paint = hint.level === "critical" ? ui.red : ui.yellow;
  ui.log(paint("\n  ⚠ " + hint.text));
  if (hint.level === "critical") ui.log(paint("    Until then, prefer models with :free suffix or /model to pick one."));
  markAlerted(config, hint.level);
}

const program = new Command();

program
  .name("myagent")
  .description("A terminal AI coding agent with manual model selection")
  .version("1.0.0");

program
  .argument("[prompt...]", "optional question; run non-interactively")
  .option("-m, --model <id>", "model to use (e.g. openrouter/openai/gpt-4o or nvidia/nemotron-3-ultra-550b-a55b:free)")
  .option("--list-models", "list all available models and exit")
  .option("--providers", "list providers with API key status and exit")
  .option("-v, --verbose", "print extra logging")
  .option("--no-color", "disable ANSI colors")
  .option("--cwd <dir>", "working directory for the agent")
  .option("-s, --session <id>", "resume a previous session")
  .option("--config-path", "print config file path and exit")
  .action(async (promptArgs, opts) => {
    ui.suppress(!opts.color);

    if (opts.configPath) {
      console.log(CONFIG_PATH);
      process.exit(0);
    }

    const cwd = path.resolve(opts.cwd || process.cwd());
    process.env.MYAGENT_CWD = cwd;

    const config = loadConfig();

    if (opts.listModels) {
      const models = listModels(config);
      console.log("\n  Available models:");
      for (const m of models) {
        const free = m.category === "free" || /:free$/.test(m.model);
        const freeTag = free ? " [free]" : "";
        console.log(`  ${ui.cyan(m.name)}${freeTag}  ${ui.gray(m.id)}`);
      }
      console.log("");
      process.exit(0);
    }

    if (opts.providers) {
      console.log("\n  Providers:");
      for (const [pkey, p] of Object.entries(config.provider)) {
        const status = getApiKey(p) ? ui.green("key set ✓") : ui.yellow("no key (set env)");
        console.log(`  ${pkey.padEnd(12)} ${status}  ${ui.gray(p.baseURL)}`);
      }
      console.log("");
      process.exit(0);
    }

    const initialModel = opts.model || config.model || "openrouter/free";

    await showBalanceAlert(config);

    if (opts.session) {
      const s = loadSession(opts.session);
      if (!s) {
        ui.error(`Session ${opts.session} not found.`);
        process.exit(1);
      }
      ui.log(ui.dim(`Resuming session ${opts.session} (${s.messages.length} messages).`));
      const resumed = s.messages || [];
      try {
        await runAgent({
          model: opts.model || s.model?.id || initialModel,
          messages: resumed,
          config,
          cwd,
          verbose: opts.verbose,
          onText: (t) => process.stdout.write(t)
        });
        process.stdout.write("\n");
      } catch (err) {
        ui.error(`\n  ${formatError(err)}`);
      }
      process.exit(0);
    }

    // Single-shot mode: `myagent "question"`
    if (promptArgs && promptArgs.length) {
      const question = promptArgs.join(" ");
      const model = getModelById(config, initialModel) || resolveModel(config, initialModel);
      ui.log(ui.dim(`  model: ${model.id}`));
      ui.log(ui.dim("\n  ── assistant ──"));
      try {
        await runAgent({
          model: model.id,
          messages: [{ role: "user", content: question }],
          config,
          cwd,
          verbose: opts.verbose,
          onText: (t) => {
            process.stdout.write(t);
          }
        });
        console.log("\n");
      } catch (err) {
        ui.error(`\n  ${formatError(err)}`);
        process.exit(1);
      }
      process.exit(0);
    }

    // Interactive REPL
    await repl({ initialModel, cwd, verbose: opts.verbose });
  });

program.parse(process.argv);