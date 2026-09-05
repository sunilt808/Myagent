const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const GRAY = "\x1b[90m";

let suppressColor = false;
if (process.env.NO_COLOR || !process.stdout.isTTY) {
  suppressColor = true;
}

function paint(code, text) {
  return suppressColor ? text : `${code}${text}${RESET}`;
}

const ui = {
  suppress(colorEnabled) {
    suppressColor = !colorEnabled;
  },
  bold: (t) => paint(BOLD, t),
  dim: (t) => paint(DIM, t),
  red: (t) => paint(RED, t),
  green: (t) => paint(GREEN, t),
  yellow: (t) => paint(YELLOW, t),
  blue: (t) => paint(BLUE, t),
  magenta: (t) => paint(MAGENTA, t),
  cyan: (t) => paint(CYAN, t),
  gray: (t) => paint(GRAY, t),

  log: (...args) => console.log(...args),
  error: (...args) => console.error(paint(RED, ...args)),

  toolStart(name, detail) {
    console.log(ui.dim(`\n  ${ui.cyan("[" + name + "]")} ${ui.dim(detail || "")}`));
  },
  toolResult(out) {
    const text = String(out ?? "(empty)");
    const lines = text.split("\n");
    const shown = lines.length > 50 ? lines.slice(0, 50).join("\n") + ui.dim(`\n... (${lines.length} lines total)`) : text;
    for (const line of shown.split("\n")) {
      console.log(ui.gray("    " + line));
    }
  },
  thinking() {
    process.stdout.write(ui.dim("  ⏳ thinking..."));
  },
  thinkingDone() {
    process.stdout.write("\r" + " ".repeat(20) + "\r");
  },
  userPrompt() {
    console.log(ui.cyan("\n  You ▸"));
  }
};

module.exports = ui;