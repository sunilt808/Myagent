const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const TOOL_SCHEMAS = [
  {
    name: "bash",
    description:
      "Execute a shell command on the user's system. Use for anything terminal-related: git, npm, node, check versions, list files, etc. On Windows this runs through cmd /c.",
    args: { command: "string", timeout_ms: "number" },
    required: ["command"]
  },
  {
    name: "read",
    description: "Read a file from the filesystem. Returns contents with line numbers. Supports offset/limit ranges for large files.",
    args: { filePath: "string", offset: "number", limit: "number" },
    required: ["filePath"]
  },
  {
    name: "write",
    description: "Create a new file or overwrite an existing one with the given content.",
    args: { filePath: "string", content: "string" },
    required: ["filePath", "content"]
  },
  {
    name: "edit",
    description:
      "Modify an existing file via exact string replacement. The oldString must match exactly (including whitespace) ONCE in the file. Use read first to inspect the file.",
    args: { filePath: "string", oldString: "string", newString: "string" },
    required: ["filePath", "oldString", "newString"]
  },
  {
    name: "apply_patch",
    description:
      "Apply a unified-diff style patch to the filesystem. Supports Add/Update/Delete/Readd/Rename markers. Paths are relative to the cwd.",
    args: { patch: "string" },
    required: ["patch"]
  },
  {
    name: "glob",
    description: "Find files by glob pattern, e.g. **/*.js or src/**/*.{ts,tsx}. Returns matching paths sorted by mtime.",
    args: { pattern: "string", path: "string" },
    required: ["pattern"]
  },
  {
    name: "grep",
    description: "Search file contents using a regular expression. Filters by optional glob include, e.g. *.js. Returns file:line matches.",
    args: { pattern: "string", path: "string", include: "string" },
    required: ["pattern"]
  },
  {
    name: "list",
    description: "List the contents of a directory. Entries dirs get a trailing /.",
    args: { directory: "string" }
  },
  {
    name: "glob_read",
    description: "Read multiple files at once from a glob pattern. Returns each file with its path prefix.",
    args: { pattern: "string", limit: "number" },
    required: ["pattern"]
  },
  {
    name: "webfetch",
    description: "Fetch a URL and return its content converted to markdown/text. Use for docs, web pages, APIs.",
    args: { url: "string" },
    required: ["url"]
  }
];

function toOpenAITools(hasWeb) {
  const schemas = hasWeb
    ? TOOL_SCHEMAS
    : TOOL_SCHEMAS.filter((t) => t.name !== "webfetch");
  return schemas.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(Object.entries(t.args).map(([k, v]) => [k, { type: v }])),
        required: t.required
      }
    }
  }));
}

function resolveBase() {
  const cwd = process.env.MYAGENT_CWD || process.cwd();
  return path.resolve(cwd);
}

function stripLineNumbers(filePath) {
  return filePath;
}

function runBash(command, timeoutMs = 60000) {
  return new Promise((resolve) => {
    const shell =
      process.platform === "win32" ? { shell: "cmd.exe" } : { shell: "/bin/bash", args: ["-c"] };
    exec(command, {
      maxBuffer: 20 * 1024 * 1024,
      timeout: timeoutMs || 60000,
      cwd: resolveBase(),
      windowsHide: true,
      env: process.env
    }, (error, stdout, stderr) => {
      const out = [];
      if (stdout) out.push(stdout);
      if (stderr) out.push(stderr);
      if (error && !out.length) out.push(error.message);
      if (error && error.killed) out.push("(command timed out)");
      resolve(out.join("\n").trim() || "(no output)");
    });
  });
}

function readFile(filePath, offset, limit) {
  const abs = path.resolve(resolveBase(), filePath);
  if (!fs.existsSync(abs)) return `File not found: ${filePath}`;
  const content = fs.readFileSync(abs, "utf8");
  const lines = content.split("\n");
  const start = (offset || 1) - 1;
  const end = limit ? start + limit : lines.length;
  const slice = lines.slice(start, end);
  const width = String(end).length;
  return slice.map((l, i) => String(start + i + 1).padStart(width) + ": " + l).join("\n");
}

function writeFile(filePath, content) {
  const abs = path.resolve(resolveBase(), filePath);
  const hasExisting = fs.existsSync(abs);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  return hasExisting ? `Updated file: ${filePath}` : `Created file: ${filePath}`;
}

function editFile(filePath, oldString, newString) {
  const abs = path.resolve(resolveBase(), filePath);
  if (!fs.existsSync(abs)) return `File not found: ${filePath}`;
  const content = fs.readFileSync(abs, "utf8");
  const count = content.split(oldString).length - 1;
  if (count === 0) return `Edit failed: oldString not found in ${filePath}.`;
  if (count > 1)
    return `Edit failed: oldString matches ${count} times in ${filePath}. Provide more surrounding context or use replaceAll.`;
  fs.writeFileSync(abs, content.replace(oldString, newString), "utf8");
  return `Edited ${filePath}.`;
}

function applyPatch(patchText) {
  const results = [];
  const lines = patchText.split("\n");
  let mode = null;
  let filePath = null;
  let sections = [];
  const hunks = [];

  const finishFile = () => {
    if (!mode || !filePath) return;
    if (mode === "Add") {
      results.push(writeFile(filePath, sections.join("\n")));
    } else if (mode === "Delete") {
      const abs = path.resolve(resolveBase(), filePath);
      results.push(fs.existsSync(abs) ? (fs.unlinkSync(abs), `Deleted ${filePath}`) : `Delete failed: ${filePath} not found`);
    } else if (mode === "Move") {
      const abs = path.resolve(resolveBase(), filePath);
      if (fs.existsSync(abs)) {
        const dest = sections.join("\n").trim() || filePath;
        fs.renameSync(abs, path.resolve(resolveBase(), dest));
        results.push(`Moved ${filePath} -> ${dest}`);
      } else {
        results.push(`Move failed: ${filePath} not found`);
      }
    } else if (mode === "Update") {
      try {
        results.push(applyHunks(filePath, sections.join("\n")));
      } catch (e) {
        results.push(`Patch error in ${filePath}: ${e.message}`);
      }
    }
  };

  for (const line of lines) {
    if (line.startsWith("*** Update File: ")) {
      finishFile();
      mode = "Update";
      filePath = line.slice("*** Update File: ".length).trim();
      sections = [];
    } else if (line.startsWith("*** Add File: ")) {
      finishFile();
      mode = "Add";
      filePath = line.slice("*** Add File: ".length).trim();
      sections = [];
    } else if (line.startsWith("*** Delete File: ")) {
      finishFile();
      mode = "Delete";
      filePath = line.slice("*** Delete File: ".length).trim();
      sections = [];
    } else if (line.startsWith("*** Move to: ")) {
      finishFile();
      mode = "Move";
      filePath = line.slice("*** Move to: ".length).trim();
      sections = [];
    } else if (line === "*** End Patch ***") {
      finishFile();
      mode = null;
      filePath = null;
      sections = [];
    } else if (mode) {
      sections.push(line);
    }
  }
  finishFile();

  return results.length ? results.join("\n") : "No changes applied. Patch format not recognized.";
}

// Minimal but functional unified-diff applier for `*** Update File: X` blocks.
function applyHunks(filePath, patchBody) {
  const abs = path.resolve(resolveBase(), filePath);
  if (!fs.existsSync(abs)) return `Patch failed: file not found - ${filePath}`;
  const fileContent = fs.readFileSync(abs, "utf8");
  let applied = fileContent;

  // Strip leading ---/+++ headers if present
  const body = patchBody
    .split("\n")
    .filter((l) => !/^(\+\+\+|---) /.test(l))
    .join("\n");

  const hunkLines = body.split("\n");
  let hunk = { oldN: 0, newN: 0, oldLen: 0, newLen: 0 };
  let oldStr = "";
  let newStr = "";
  let matchedOnce = false;

  const flush = () => {
    if (oldStr) {
      const count = applied.split(oldStr).length - 1;
      if (count === 0) throw new Error(`hunk not found in ${filePath}`);
      if (count > 1) throw new Error(`hunk matches ${count} times in ${filePath}`);
      applied = applied.replace(oldStr, newStr);
      matchedOnce = true;
    }
    oldStr = "";
    newStr = "";
  };

  for (const line of hunkLines) {
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (m) {
      flush();
      hunk = { oldN: +m[1], newN: +m[2] };
      continue;
    }

    if (!hunk.oldN) continue; // ignore junk before first @@

    let oldLine = null;
    let newLine = null;
    if (line.startsWith("+")) newLine = line.slice(1);
    else if (line.startsWith("-")) oldLine = line.slice(1);
    else {
      oldLine = line.slice(1);
      newLine = line.slice(1);
    }

    if (oldLine !== null) {
      if (oldStr) oldStr += "\n";
      oldStr += oldLine;
    }
    if (newLine !== null) {
      if (newStr) newStr += "\n";
      newStr += newLine;
    }
  }
  flush();

  if (!matchedOnce) return `Patch failed: no hunks matched in ${filePath}`;
  fs.writeFileSync(abs, applied, "utf8");
  return `Patched ${filePath}`;
}

function globCwd(pattern, dir) {
  const base = path.resolve(resolveBase(), dir || ".");
  const rg = require("child_process").spawnSync(
    "rg",
    ["--files", "--hidden", "-g", "!.git", "-g", pattern, base],
    { cwd: base, encoding: "utf8", timeout: 15000, shell: process.platform === "win32" }
  );
  if (rg.status === 0 || rg.status === 1) return (rg.stdout || "").trim();
  if (rg.error) return `rg failed: ${rg.error.message}. Fallback to node glob.`;
  return "";
}

function nodeGlob(pattern, dir) {
  const base = path.resolve(resolveBase(), dir || ".");
  const results = [];
  const tokens = pattern.split("/");
  const walk = (current, depth) => {
    if (depth >= tokens.length) return;
    const token = tokens[depth];
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    if (token === "**") {
      walk(current, depth + 1);
      for (const e of entries) if (e.isDirectory()) walk(path.join(current, e.name), depth);
    } else {
      const regex = new RegExp("^" + token.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
      for (const e of entries) {
        if (regex.test(e.name)) {
          const rel = path.relative(base, path.join(current, e.name)).replace(/\\/g, "/");
          if (depth === tokens.length - 1) results.push(rel);
          else if (e.isDirectory()) walk(path.join(current, e.name), depth + 1);
        }
      }
    }
  };
  walk(base, 0);
  return results.join("\n");
}

function globFiles(pattern, dir) {
  if (process.env.MYAGENT_NO_RG) return nodeGlob(pattern, dir);
  try {
    const out = globCwd(pattern, dir);
    if (out) return out;
  } catch {}
  return nodeGlob(pattern, dir);
}

function grepFiles(pattern, dir, include) {
  const base = path.resolve(resolveBase(), dir || ".");
  if (process.env.MYAGENT_NO_RG === "1") return nodeGrep(pattern, base, include);
  const args = ["--line-number", "--no-heading", "--hidden", "-g", "!.git/**", "-g", "!node_modules/**"];
  if (include) args.push("-g", include);
  args.push(pattern, base);
  const out = require("child_process").spawnSync(
    "rg",
    args,
    { cwd: base, encoding: "utf8", timeout: 15000, shell: process.platform === "win32" }
  );
  if (out.status === 0 || out.status === 1) return (out.stdout || "").trim() || "No matches.";
  if (out.error && process.env.MYAGENT_NO_RG !== "1") return nodeGrep(pattern, base, include);
  return "No matches.";
}

function nodeGrep(pattern, base, include) {
  const results = [];
  let regex;
  try {
    regex = new RegExp(pattern);
  } catch {
    return `Invalid regex: ${pattern}`;
  }
  const walkDir = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === ".git" || e.name === "node_modules" || e.name === ".myagent") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkDir(full);
      else if (e.isFile()) {
        if (include) {
          const inc = new RegExp("^" + include.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"));
          if (!inc.test(e.name)) continue;
        }
        let content;
        try {
          content = fs.readFileSync(full, "utf8");
        } catch {
          continue;
        }
        const rel = path.relative(base, full).replace(/\\/g, "/");
        content.split("\n").forEach((line, i) => {
          if (regex.test(line)) results.push(`${rel}:${i + 1}:${line}`);
        });
      }
    }
  };
  walkDir(base);
  return results.length ? results.join("\n") : "No matches.";
}

function listDirectory(dir) {
  const base = path.resolve(resolveBase(), dir || ".");
  if (!fs.existsSync(base)) return `Directory not found: ${dir || "."}`;
  const entries = fs.readdirSync(base, { withFileTypes: true })
    .sort((a, b) => (a.name.localeCompare(b.name)))
    .map((e) => (e.isDirectory() ? e.name + "/" : e.name));
  return entries.join("\n") || "(empty directory)";
}

async function fetchUrl(url) {
  if (!/^https?:\/\//i.test(url)) return `Invalid URL: ${url}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "myagent/1.0" },
    signal: AbortSignal.timeout(30000)
  });
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  if (contentType.includes("json")) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {}
  }
  return text.slice(0, 100000);
}

const tools = {
  bash: ({ command, timeout_ms }) => runBash(command, timeout_ms),
  read: ({ filePath, offset, limit }) => readFile(filePath, offset, limit),
  write: ({ filePath, content }) => writeFile(filePath, content),
  edit: ({ filePath, oldString, newString }) => editFile(filePath, oldString, newString),
  apply_patch: ({ patch }) => applyPatch(patch),
  glob: ({ pattern, path }) => globFiles(pattern, path),
  grep: ({ pattern, path, include }) => grepFiles(pattern, path, include),
  list: ({ directory }) => listDirectory(directory),
  glob_read: async ({ pattern, limit }) => {
    const files = globFiles(pattern);
    if (!files) return "No files matched.";
    const list = files.split("\n").slice(0, limit || 20);
    const out = [];
    for (const f of list) {
      out.push(`===== ${f} =====`);
      out.push(readFile(f, 1, 400));
    }
    return out.join("\n").slice(0, 60000);
  },
  webfetch: async ({ url }) => fetchUrl(url)
};

async function executeTool(name, args) {
  const fn = tools[name];
  if (!fn) return `Unknown tool: ${name}`;
  try {
    const result = await fn(args || {});
    return typeof result === "string" ? result : JSON.stringify(result, null, 2);
  } catch (err) {
    return `Tool "${name}" error: ${err.message}`;
  }
}

module.exports = {
  TOOL_SCHEMAS,
  toOpenAITools,
  executeTool,
  tools
};