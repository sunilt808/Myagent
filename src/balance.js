const fs = require("fs");
const path = require("path");
const os = require("os");

const BALANCE_WARN = Number(process.env.MYAGENT_BALANCE_WARN ?? 1.0);
const BALANCE_CRITICAL = Number(process.env.MYAGENT_BALANCE_CRITICAL ?? 0.10);

async function getBalance(apiKey) {
  if (!apiKey) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) return null;
    const body = await res.json();
    const d = body?.data;
    if (!d) return null;
    const usageObj = d.usage;
    const isFreeTier = d.is_free_tier === true;
    const remaining = d.limit_remaining ?? usageObj?.remaining_credits ?? null;
    const limit = d.limit ?? usageObj?.limit ?? null;
    const total = typeof usageObj === "number" ? usageObj : usageObj?.total_usage ?? null;
    return { remaining, limit, total, isFreeTier };
  } catch {
    return null;
  }
}

function balanceHints(balance) {
  if (!balance) return null;
  if (balance.isFreeTier && (balance.remaining === null || balance.remaining === undefined)) return null;
  if (balance.remaining === null || balance.remaining === undefined) return null;
  const remaining = Number(balance.remaining);
  if (remaining <= BALANCE_CRITICAL)
    return {
      level: "critical",
      text: `OpenRouter credits are almost empty ($ ${remaining.toFixed(4)}). Top up at openrouter.ai or replace OPENROUTER_API_KEY in .env / ~/.myagent/.env now.`
    };
  if (remaining <= BALANCE_WARN)
    return {
      level: "warn",
      text: `OpenRouter credits running low: $ ${remaining.toFixed(2)} left. Consider topping up or swapping the key before heavy use.`
    };
  return { level: "ok", text: `$ ${remaining.toFixed(2)} remaining` };
}

function alertFile(config) {
  const dir = config?.path ? path.dirname(config.path) : path.join(os.homedir(), ".myagent");
  return path.join(dir, "last-balance-alert.json");
}

function wasAlreadyAlerted(config, level) {
  try {
    const data = JSON.parse(fs.readFileSync(alertFile(config), "utf8"));
    return data.level === level && Date.now() - (data.at || 0) < 6 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markAlerted(config, level) {
  try {
    fs.mkdirSync(path.dirname(alertFile(config)), { recursive: true });
    fs.writeFileSync(alertFile(config), JSON.stringify({ level, at: Date.now() }));
  } catch {}
}

module.exports = { getBalance, balanceHints, wasAlreadyAlerted, markAlerted };