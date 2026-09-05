const readline = require("readline");

const COMMON_BASH_SAFE = [
  /^(git status|git log|git diff|git show|git branch|git remote)\b/,
  /^(ls|dir|cd|pwd|where|which|node -v|npm -v|git --version|python --version)\b/,
  /^echo\b/,
  /^(cat|type)\b/
];

const DIM = "\x1b[90m";
const RESET = "\x1b[0m";
const dim = (t) => DIM + t + RESET;

function makePermissionChecker(permissions, io) {
  const remembered = {};

  function askOnce(promptText) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(promptText, (a) => {
        rl.close();
        resolve(a.trim().toLowerCase());
      });
    });
  }

  async function check(toolName, args) {
    const rule = permissions[toolName] || "allow";
    if (rule === "allow") return { action: "allow" };
    if (rule === "deny") return { action: "deny", reason: `Tool "${toolName}" is disabled by permissions.` };

    // In non-interactive mode (piped input), a prompt would hang forever.
    // Auto-deny asks so the model can adapt and continue.
    if (!process.stdin.isTTY) {
      return { action: "deny", reason: `"${toolName}" requires approval but stdin is not interactive. Set permissions to "allow" in config to run non-interactively.` };
    }

    if (toolName === "bash") {
      const cmd = (args.command || "").trim();
      if (COMMON_BASH_SAFE.some((re) => re.test(cmd))) return { action: "allow" };
      if (remembered[cmd] === "always") return { action: "allow" };
      if (remembered[cmd] === "skip") return { action: "deny", reason: `Skipped (remembered): ${cmd}` };
      console.log(dim(`\n  bash: ${cmd}`));
      const ans = await askOnce(
        dim("  Run? [y]es / [n]o / [a]lways / [s]kip-this-cmd > ")
      );
      if (ans === "n" || ans === "s") {
        if (ans === "s") remembered[cmd] = "skip";
        return { action: "deny", reason: `User declined: ${cmd}` };
      }
      if (ans === "a") remembered[cmd] = "always";
      if (ans === "y" || ans === "a" || ans === "") return { action: "allow" };
      return { action: "deny", reason: `User declined: ${cmd}` };
    }

    const detail =
      toolName === "webfetch"
        ? args.url
        : toolName === "write" || toolName === "edit"
        ? args.filePath
        : toolName;
    console.log(dim(`\n  tool ${toolName}: ${detail}`));
    const ans = await askOnce(dim("  Allow? [y]es / [n]o > "));
    if (ans === "y" || ans === "") return { action: "allow" };
    return { action: "deny", reason: `User declined: ${toolName} (${detail})` };
  }

  return { check };
}

module.exports = { makePermissionChecker };