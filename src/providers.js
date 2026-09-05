const fs = require("fs");
const path = require("path");
const os = require("os");

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SLOT_DEFS = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    envKeys: ["OPENROUTER_API_KEY"],
    capabilities: { chat: true, streaming: true, toolCalls: true, vision: true },
    discovery: null,
    modelFilter: null,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    envKeys: ["OPENAI_API_KEY"],
    capabilities: { chat: true, streaming: true, toolCalls: true, vision: true },
    discovery: null,
    modelFilter: null,
  },
  google: {
    id: "google",
    label: "Google Gemini",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    capabilities: { chat: true, streaming: true, toolCalls: true, vision: true },
    discovery: {
      urlFn: (key) => `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      auth: "none",
      transform: (item) => {
        const name = (item.name || "").replace(/^models\//, "");
        return { id: name, name };
      },
      filter: (m) => /^(gemini-|gemma-)/.test(m.id) && !/image|tts|veo|lyria|embed|robotics|audio|aqa|banana|transcribe|computer.use|antigravity|deep.research/i.test(m.id),
    },
    modelFilter: (id) => /^(gemini-|gemma-)/.test(id) && !/image|tts|veo|lyria|embed|robotics|audio|aqa|banana|transcribe|computer.use|antigravity|deep.research/i.test(id),
  },
  xai: {
    id: "xai",
    label: "xAI (Grok)",
    envKeys: ["XAI_API_KEY"],
    capabilities: { chat: true, streaming: true, toolCalls: true, vision: true },
    discovery: null,
    modelFilter: null,
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    envKeys: ["ANTHROPIC_API_KEY"],
    capabilities: { chat: true, streaming: true, toolCalls: true, vision: true },
    discovery: null,
    modelFilter: null,
  },
  groq: {
    id: "groq",
    label: "Groq",
    envKeys: ["GROQ_API_KEY"],
    capabilities: { chat: true, streaming: true, toolCalls: true, vision: false },
    discovery: {
      urlFn: (key) => "https://api.groq.com/openai/v1/models",
      auth: "bearer",
      transform: (item) => ({ id: item.id, name: item.id }),
      filter: (m) => !/whisper|guard|canopylabs|prompt-guard|safeguard|compound/i.test(m.id) && (m.id.includes("/") || m.id.includes("gpt-oss")),
    },
    modelFilter: (id) => !/whisper|guard|canopylabs|prompt-guard|safeguard|compound/i.test(id),
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    envKeys: ["MISTRAL_API_KEY"],
    capabilities: { chat: true, streaming: true, toolCalls: true, vision: false },
    discovery: {
      urlFn: () => "https://api.mistral.ai/v1/models",
      auth: "bearer",
      transform: (item) => ({ id: item.id, name: item.id }),
      filter: (m) => !/embed|ocr|tts|transcribe|moderation|fim|realtime|clip|vibe-cli|labs-leanstral|embed/i.test(m.id),
    },
    modelFilter: (id) => !/embed|ocr|tts|transcribe|moderation|fim|realtime|clip|vibe-cli|labs-leanstral|embed/i.test(id),
  },
  zai: {
    id: "zai",
    label: "Z.ai (GLM)",
    envKeys: ["ZAI_API_KEY"],
    capabilities: { chat: true, streaming: true, toolCalls: true, vision: false },
    discovery: {
      urlFn: () => "https://api.z.ai/api/paas/v4/models",
      auth: "bearer",
      transform: (item) => ({ id: item.id, name: item.id }),
      filter: (m) => /^glm-/i.test(m.id),
    },
    modelFilter: (id) => /^glm-/i.test(id),
  },
  huggingface: {
    id: "huggingface",
    label: "Hugging Face",
    envKeys: ["HF_TOKEN", "HUGGINGFACE_TOKEN"],
    capabilities: { chat: true, streaming: true, toolCalls: false, vision: false },
    discovery: {
      urlFn: () => "https://router.huggingface.co/v1/models",
      auth: "bearer",
      transform: (item) => {
        const id = item.id || "";
        return { id, name: id.split("/").pop() || id };
      },
      filter: (m) => m.id && m.id.includes("/") && !/(embed|transcri|audio|image-gen|diffusion|tts|ocr|segment|vision-encoder)/i.test(m.id),
    },
    modelFilter: (id) => id && id.includes("/"),
  },
  custom: {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    envKeys: [],
    capabilities: { chat: true, streaming: true, toolCalls: true, vision: false },
    discovery: null,
    modelFilter: null,
  },
};

function getSlot(id) {
  return SLOT_DEFS[id] || null;
}

function allSlots() {
  return Object.values(SLOT_DEFS);
}

function resolveKey(slot) {
  if (!slot || !slot.envKeys) return null;
  for (const k of slot.envKeys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return null;
}

function isConfigured(id) {
  return !!resolveKey(getSlot(id));
}

function cacheDir() {
  const dir = path.join(os.homedir(), ".myagent", "providers");
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

function cachePath(id) {
  return path.join(cacheDir(), `${id}.json`);
}

function readCache(id) {
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath(id), "utf8"));
    if (Array.isArray(raw.models) && raw.fetchedAt && Date.now() - new Date(raw.fetchedAt).getTime() < CACHE_TTL_MS) {
      return raw.models;
    }
  } catch {}
  return null;
}

function writeCache(id, models) {
  try {
    fs.writeFileSync(cachePath(id), JSON.stringify({ models, fetchedAt: new Date().toISOString() }, null, 2));
  } catch {}
}

async function discoverModels(id) {
  const slot = getSlot(id);
  if (!slot || !slot.discovery) return null;
  const key = resolveKey(slot);
  if (!key) return null;

  const cached = readCache(id);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const headers = {};
    if (slot.discovery.auth === "bearer") headers["Authorization"] = `Bearer ${key}`;
    const res = await fetch(slot.discovery.urlFn(key), { signal: controller.signal, headers });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = await res.json();
    const raw = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    let models = raw.map(slot.discovery.transform).filter(Boolean);
    if (slot.discovery.filter) models = models.filter(slot.discovery.filter);
    models = models.map((m) => ({ id: `${id}/${m.id}`, provider: id, model: m.id, name: m.name || m.id, category: "general" }));
    if (models.length > 0) writeCache(id, models);
    return models.length > 0 ? models : null;
  } catch {
    return null;
  }
}

function getCatalogModels(config, id) {
  const models = [];
  const provider = config?.provider?.[id];
  if (!provider?.models) return models;
  for (const [mkey, meta] of Object.entries(provider.models)) {
    models.push({
      id: `${id}/${mkey}`,
      provider: id,
      model: mkey,
      name: meta?.name || mkey,
      category: meta?.category || "general",
      options: meta?.options || {},
    });
  }
  return models;
}

async function getModels(config, id) {
  const slot = getSlot(id);
  if (!slot) return getCatalogModels(config, id);

  const discovered = await discoverModels(id);
  const catalog = getCatalogModels(config, id);

  if (!discovered || discovered.length === 0) return catalog;

  const catalogIds = new Set(catalog.map((m) => m.id));
  const merged = [...catalog];
  for (const d of discovered) {
    if (!catalogIds.has(d.id)) merged.push(d);
  }
  return merged;
}

function getCapabilities(id) {
  const slot = getSlot(id);
  return slot?.capabilities || { chat: true, streaming: true, toolCalls: false, vision: false };
}

function providerStatus() {
  return allSlots().map((s) => ({
    id: s.id,
    label: s.label,
    configured: !!resolveKey(s),
  }));
}

module.exports = {
  SLOT_DEFS,
  getSlot,
  allSlots,
  resolveKey,
  isConfigured,
  getCatalogModels,
  discoverModels,
  getModels,
  getCapabilities,
  providerStatus,
  cachePath,
};
