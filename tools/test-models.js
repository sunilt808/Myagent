// Quick smoke test: one trivial request per model. Minimal cost.
// Usage: node tools/test-models.js [tag] [filter]
// Builds the list straight from src/config.js so results always match the catalog.
const { loadConfig } = require("../src/config");
const { getModelById, resolveModel, getApiModelId, ensureApiConfig } = require("../src/models");
const { formatError } = require("../src/agent");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

function allCatalogModels() {
  const config = loadConfig();
  const out = [];
  for (const [provider, p] of Object.entries(config.provider || {})) {
    if (!p.models) continue;
    for (const slug of Object.keys(p.models)) {
      out.push(`${provider}/${slug}`);
    }
  }
  return out;
}

const ALL = allCatalogModels();

async function testOne(modelId) {
  const config = loadConfig();
  const model = getModelById(config, modelId) || resolveModel(config, modelId);
  let client;
  try {
    const { apiKey, baseURL, defaultHeaders } = ensureApiConfig(model);
    client = new OpenAI({ apiKey, baseURL, defaultHeaders, timeout: 60000, maxRetries: 0 });
  } catch (err) {
    return { model: model.id, status: "fail", ms: 0, reply: null, error: formatError(err) };
  }
  const start = Date.now();
  try {
    const res = await client.chat.completions.create({
      model: getApiModelId(model),
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 20
    });
    const reply = (res.choices?.[0]?.message?.content || "").trim().slice(0, 60);
    const ok = /ok/i.test(reply);
    return { model: model.id, status: ok ? "ok" : "reply", ms: Date.now() - start, reply, error: null };
  } catch (err) {
    return { model: model.id, status: "fail", ms: Date.now() - start, reply: null, error: formatError(err).slice(0, 120) };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const tag = process.argv[2] || "test";
  const only = process.argv[3];
  const list = only ? ALL.filter((m) => m.includes(only)) : ALL;

  const out = [];
  for (const id of list) {
    process.stdout.write(`  testing ${id} ... `);
    const r = await testOne(id);
    out.push(r);
    const mark = r.status === "ok" ? "✓" : r.status === "reply" ? "~" : "✗";
    process.stdout.write(`${mark} (${r.ms}ms)\n`);
    if (r.error) console.log(`      ${r.error}`);
    await sleep(1200);
  }

  const resultsDir = path.join(__dirname, "..", "tools");
  const file = path.join(resultsDir, `model-test-${tag}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\n  Results → ${file}`);
  const okCount = out.filter((r) => r.status === "ok").length;
  const replyCount = out.filter((r) => r.status === "reply").length;
  const failCount = out.filter((r) => r.status === "fail").length;
  console.log(`  ok=${okCount} odd-reply=${replyCount} fail=${failCount} total=${out.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});