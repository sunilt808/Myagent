const { loadConfig, getProvider, saveConfig, CONFIG_PATH } = require("./config");
const { getSlot, resolveKey, getCapabilities } = require("./providers");

function parseModelId(raw) {
  // Split on the FIRST slash only. Model ids themselves may contain "/",
  // e.g. provider=groq, model=openai/gpt-oss-120b.
  const idx = String(raw).indexOf("/");
  if (idx >= 0) {
    return { provider: String(raw).slice(0, idx), model: String(raw).slice(idx + 1) };
  }
  return { provider: null, model: String(raw) };
}

function listModels(config) {
  const result = [];
  const providers = config.provider || {};
  for (const [pkey, provider] of Object.entries(providers)) {
    for (const [mkey, meta] of Object.entries(provider.models || {})) {
      result.push({
        id: `${pkey}/${mkey}`,
        provider: pkey,
        model: mkey,
        name: meta?.name || mkey,
        category: meta?.category || "general",
        options: meta?.options || {}
      });
    }
  }
  return result;
}

function getModelById(config, id) {
  const { provider, model } = parseModelId(id);
  const candidates = listModels(config);

  // 1. Exact full provider/model id (e.g. groq/openai/gpt-oss-120b)
  let hit = candidates.find((m) => m.id === id);
  if (hit) return hit;

  // 2. Provider-scoped match (provider + exact model id within it)
  if (provider) {
    hit = candidates.find((m) => m.provider === provider && m.model === model);
    if (!hit) hit = candidates.find((m) => m.provider === provider && m.model.endsWith(model));
    if (hit) return hit;
  }

  // 3. Unique global partial match
  const matches = candidates.filter(
    (m) => m.model === id || m.model.endsWith("/" + id) || (m.name || "").toLowerCase() === String(id).toLowerCase()
  );
  if (matches.length === 1) return matches[0];

  return null;
}

function listModelsForProvider(config, provider) {
  return listModels(config).filter((m) => m.provider === provider);
}

function getApiModelId(model) {
  if (model.provider === "openrouter" && (model.model === "free" || model.model === "openrouter/free")) {
    return "openrouter/free";
  }
  return model.model;
}

function resolveModel(config, requested) {
  let modelId = requested || config.model || "openrouter/openai/gpt-4o";

  const direct = getModelById(config, modelId);
  if (direct) return direct;

  const { provider, model } = parseModelId(modelId);
  const p = getProvider(config, provider || "openrouter") || getProvider(config, "openrouter");
  const cap = getCapabilities(provider || "openrouter");
  return {
    id: `${provider || "openrouter"}/${model}`,
    provider: provider || "openrouter",
    model,
    name: model,
    category: "general",
    options: {},
    capabilities: cap,
  };
}

function setDefaultModel(config, modelId) {
  config.model = modelId;
  saveConfig(config);
}

function getApiKey(provider) {
  if (!provider) return null;
  let key = null;
  if (typeof provider.apiKey === "function") key = provider.apiKey();
  else if (typeof provider.apiKey === "string") {
    if (/^[A-Z_][A-Z0-9_]*$/.test(provider.apiKey)) key = process.env[provider.apiKey];
    else key = provider.apiKey;
  }
  return key || null;
}

function ensureApiConfig(model) {
  const config = loadConfig();
  const p = getProvider(config, model.provider);
  if (!p) throw new Error(`Unknown provider "${model.provider}". Check ${CONFIG_PATH}`);
  const key = getApiKey(p);
  if (!key) {
    const slot = getSlot(model.provider);
    const envHint = slot?.envKeys?.length ? slot.envKeys.join(" or ") : "the provider's API key";
    const label = slot?.label || model.provider;
    throw new Error(
      `No API key for provider "${label}". Add ${envHint} to your .env file (in the myagent folder) or set it as an environment variable.`
    );
  }
  return {
    apiKey: key,
    baseURL: p.baseURL,
    defaultHeaders: p.defaultHeaders || {},
    capabilities: getCapabilities(model.provider),
  };
}

module.exports = {
  parseModelId,
  listModels,
  listModelsForProvider,
  getModelById,
  getApiModelId,
  getApiKey,
  resolveModel,
  setDefaultModel,
  ensureApiConfig
};