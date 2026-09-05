const OpenAI = require("openai");
const { toOpenAITools, executeTool } = require("./tools");
const { makePermissionChecker } = require("./permissions");
const { resolveModel, ensureApiConfig, getApiModelId } = require("./models");
const ui = require("./ui");

function buildSystemPrompt(cwd, extra) {
  const base = `You are myagent, a terminal-based AI coding agent running on Windows (Node.js). You help the user write, read, and modify code in their project.

## Working directory
You operate inside: ${cwd}

When the user asks about "this project", "my code", etc., inspect the files in the working directory first with glob/list/read before answering.

## Tools
You have tools for:
- bash     : run shell commands (git, npm, node, etc.)
- read     : read files (returns line-numbered content)
- write    : create/overwrite files
- edit     : exact-string-replace edits on files (oldString must be unique)
- apply_patch : apply unified diff-style patches
- glob     : find files by glob pattern (e.g. **/*.js)
- grep     : search file contents with regex
- list     : list a directory
- glob_read: read several files at once
- webfetch : fetch a URL

## Guidelines
1. For any real task, work step-by-step: explore -> plan -> implement -> verify.
2. Use tools liberally instead of guessing about file contents.
3. After editing/creating files or running commands, verify the result when reasonable (e.g. run node --check, a build, or a test).
4. Never fabricate file contents, command output, or API responses. If a tool errors, report the error honestly.
5. Keep responses concise and directly useful. For code tasks, show the important diff hunks, not entire files.
6. When asked to explain, explain clearly with references to file:line where helpful.
7. If a request is ambiguous, ask a short clarifying question instead of guessing wildly.
8. Treat .env and any secrets as sensitive: never print API keys.

${extra ? extra : ""}`;
  return base;
}

async function createClientForModel(model) {
  const { apiKey, baseURL, defaultHeaders } = ensureApiConfig(model);
  return new OpenAI({ apiKey, baseURL, defaultHeaders, timeout: 180000, maxRetries: 1 });
}

async function runAgent({ model: modelRef, messages, config, cwd, onText, verbose }) {
  const model = typeof modelRef === "string" ? resolveModel(config, modelRef) : modelRef;
  const client = await createClientForModel(model);
  const permissions = config.permissions || {};
  const permissionChecker = makePermissionChecker(permissions);
  const hasWeb = permissions.webfetch !== "deny";
  const maxSteps = config.agent?.maxSteps || 30;

  const systemPrompt = buildSystemPrompt(cwd, config.agent?.systemPrompt);
  const history = [
    { role: "system", content: systemPrompt },
    ...messages
  ];

  let steps = 0;
  while (steps < maxSteps) {
    steps++;
    try {
      const response = await client.chat.completions.create({
        model: getApiModelId(model),
        messages: history,
        tools: toOpenAITools(hasWeb),
        tool_choice: "auto",
        stream: true,
        max_tokens: config.agent?.maxTokens ?? 4096,
        ...(model.options || {})
      });

      const toolAcc = [];
      let content = "";
      let finished = false;

      for await (const chunk of response) {
        const choice = chunk.choices && chunk.choices[0];
        if (!choice) continue;
        if (choice.finish_reason) finished = choice.finish_reason;
        const delta = choice.delta || {};
        if (delta.content) {
          content += delta.content;
          if (onText) onText(delta.content);
        }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            toolAcc[idx] = toolAcc[idx] || { id: tc.id || "", name: "", arguments: "" };
            if (tc.id) toolAcc[idx].id = tc.id;
            if (tc.function?.name) toolAcc[idx].name += tc.function.name;
            if (tc.function?.arguments) toolAcc[idx].arguments += tc.function.arguments;
          }
        }
      }

      history.push({
        role: "assistant",
        content: content || null,
        tool_calls:
          toolAcc.length && toolAcc[0].id
            ? toolAcc.map((t, i) => ({
                id: t.id || `call_${i}`,
                type: "function",
                function: { name: t.name || "unknown", arguments: t.arguments || "{}" }
              }))
            : undefined
      });

      const calls = history[history.length - 1].tool_calls;
      if (!calls || !calls.length) break;

      for (const call of calls) {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = { _raw: call.function.arguments };
        }
        const name = call.function.name;

        if (verbose) ui.log(ui.dim(`\n  [tool] ${name}`));
        const perm = await permissionChecker.check(name, args);
        let result;
        if (perm.action === "deny") {
          result = `Tool "${name}" blocked: ${perm.reason || "denied by permissions."}`;
          if (verbose) ui.log(ui.yellow("    (blocked)"));
        } else {
          ui.toolStart(name, detailOf(name, args));
          result = await executeTool(name, args);
          ui.toolResult(result);
        }
        history.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    } catch (err) {
      if (onText) onText("\n");
      throw err;
    }
  }

  if (steps >= maxSteps && history[history.length - 1].role !== "tool") {
    // Hit step cap cleanly; model already produced a response.
  }

  return { history };
}

function detailOf(name, args) {
  switch (name) {
    case "bash":
      return (args.command || "").slice(0, 80);
    case "read":
    case "write":
    case "edit":
      return args.filePath;
    case "apply_patch":
      return (args.patch || "").split("\n")[0] || "patch";
    case "glob":
    case "glob_read":
      return args.pattern;
    case "grep":
      return `${(args.pattern || "").slice(0, 40)} ${args.include ? "in " + args.include : ""}`;
    case "list":
      return args.directory || ".";
    case "webfetch":
      return args.url;
    default:
      return name;
  }
}

function formatError(err) {
  const msg = err?.error?.message || err?.message || String(err);
  if (/402|5400|credit|insufficient|balance/i.test(msg))
    return `${msg} — out of credits? Top up at openrouter.ai/credits or replace OPENROUTER_API_KEY in .env / ~/.myagent/.env.`;
  return msg;
}

module.exports = { runAgent, buildSystemPrompt, formatError };