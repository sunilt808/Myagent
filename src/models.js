const { loadConfig, getProvider, saveConfig, CONFIG_PATH } = require("./config");

function parseModelId(raw) {
  const parts = String(raw).split("/");
  if (parts.length >= 2) {
    return { provider: parts[0], model: parts.slice(1).join("/") };
  }
  return { provider: null, model: parts[0] };
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
  let hit = candidates.find((m) => m.id === id);
  if (!hit && provider) {
    hit = candidates.find((m) => m.provider === provider && m.model === model);
  }
  if (!hit) {
    hit = candidates.find(
      (m) => m.model === id || m.model.endsWith("/" + id) || (m.name || "").toLowerCase() === String(id).toLowerCase()
    );
  }
  return hit || null;
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
  return {
    id: `${provider || "openrouter"}/${model}`,
    provider: provider || "openrouter",
    model,
    name: model,
    category: "general",
    options: {}
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
    const envHint =
      model.provider === "openrouter"
        ? "OPENROUTER_API_KEY"
        : model.provider === "openai"
        ? "OPENAI_API_KEY"
        : model.provider === "google"
        ? "GEMINI_API_KEY"
        : model.provider === "xai"
        ? "XAI_API_KEY"
        : "ANTHROPIC_API_KEY";
    throw new Error(
      `No API key for provider "${model.provider}". Add ${envHint} to your .env file (in the myagent folder) or set it as an environment variable.`
    );
  }
  return {
    apiKey: key,
    baseURL: p.baseURL,
    defaultHeaders: p.defaultHeaders || {}
  };
}

module.exports = {
  parseModelId,
  listModels,
  getModelById,
  getApiModelId,
  getApiKey,
  resolveModel,
  setDefaultModel,
  ensureApiConfig
};