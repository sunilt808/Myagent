const fs = require("fs");
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });
for (const p of [path.join(__dirname, "..", ".env"), path.join(os.homedir(), ".myagent", ".env")])
  if (fs.existsSync(p)) dotenv.config({ path: p, quiet: true, override: false });

const CONFIG_DIR = process.env.MYAGENT_CONFIG_DIR || path.join(os.homedir(), ".myagent");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const SESSION_DIR = path.join(CONFIG_DIR, "sessions");

const DEFAULT_PROVIDERS = {
  openrouter: {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: () => process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "https://myagent.local",
      "X-Title": "myagent"
    },
    models: {
      "free": { name: "Free Router (auto)", category: "free", options: {} },
      "nvidia/nemotron-3-ultra-550b-a55b:free": { name: "Nemotron 3 Ultra (free)", category: "free" },
      "nvidia/nemotron-3-super-120b-a12b:free": { name: "Nemotron 3 Super (free)", category: "free" },
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": { name: "Nemotron 3 Nano Omni (free)", category: "free" },
      "nvidia/nemotron-3.5-lightning:free": { name: "Nemotron 3.5 Lightning (free)", category: "free" },
      "google/gemma-4-26b-a4b-it:free": { name: "Gemma 4 26B (free)", category: "free" },
      "poolside/laguna-s-2.1:free": { name: "Laguna S 2.1 (free)", category: "coding" },
      "cohere/north-mini-code:free": { name: "North Mini Code (free)", category: "coding" },
      "minimax/minimax-m2.7:free": { name: "MiniMax M2.7 (free)", category: "free" },
      "dots-studio/dots-3-note-preview:free": { name: "Dots 3 Note (free)", category: "free" },
      "inclusionai/ling-3.0-flash-fin:free": { name: "Ling 3.0 Flash (free)", category: "free" },
      "liquid/lfm-2.5-2.6b:free": { name: "LFM 2.5 2.6B (free)", category: "fast" },
      "openai/gpt-6-astra": { name: "GPT-6 Astra", category: "reasoning" },
      "openai/gpt-5.6-sol": { name: "GPT-5.6 Sol", category: "reasoning" },
      "openai/gpt-5.6-terra": { name: "GPT-5.6 Terra", category: "reasoning" },
      "openai/gpt-5.6-luna": { name: "GPT-5.6 Luna", category: "fast" },
      "openai/gpt-5.1": { name: "GPT-5.1", category: "reasoning" },
      "openai/gpt-5.1-codex": { name: "GPT-5.1 Codex", category: "coding" },
      "openai/gpt-4o": { name: "GPT-4o", category: "general" },
      "openai/gpt-4o-mini": { name: "GPT-4o mini", category: "fast" },
      "anthropic/claude-fable-5.1": { name: "Claude Fable 5.1", category: "reasoning" },
      "anthropic/claude-sonnet-5": { name: "Claude Sonnet 5", category: "general" },
      "anthropic/claude-opus-5": { name: "Claude Opus 5", category: "reasoning" },
      "anthropic/claude-4.6-sonnet": { name: "Claude 4.6 Sonnet", category: "general" },
      "anthropic/claude-sonnet-4": { name: "Claude Sonnet 4", category: "general" },
      "google/gemini-3.8-flash": { name: "Gemini 3.8 Flash", category: "fast" },
      "google/gemini-3.7-flash": { name: "Gemini 3.7 Flash", category: "coding" },
      "google/gemini-3.6-flash": { name: "Gemini 3.6 Flash", category: "fast" },
      "google/gemini-3.5-flash": { name: "Gemini 3.5 Flash", category: "fast" },
      "x-ai/grok-4.6": { name: "Grok 4.6", category: "coding" },
      "x-ai/grok-4.5": { name: "Grok 4.5", category: "coding" },
      "x-ai/grok-4.20-beta": { name: "Grok 4.20 Beta", category: "reasoning" },
      "deepseek/deepseek-v4-pro": { name: "DeepSeek V4 Pro", category: "reasoning" },
      "deepseek/deepseek-v4-flash": { name: "DeepSeek V4 Flash", category: "fast" },
      "deepseek/deepseek-chat": { name: "DeepSeek Chat", category: "general" },
      "qwen/qwen3.8-max": { name: "Qwen 3.8 Max", category: "general" },
      "qwen/qwen3.8-flash": { name: "Qwen 3.8 Flash", category: "fast" },
      "qwen/qwen3-coder": { name: "Qwen 3 Coder", category: "coding" },
      "microsoft/phi-4": { name: "Microsoft Phi-4", category: "general" },
      "z-ai/glm-5.3-flash": { name: "GLM 5.3 Flash", category: "fast" },
      "meta-llama/llama-4-maverick": { name: "Llama 4 Maverick", category: "general" },
      "meta-llama/llama-4-scout": { name: "Llama 4 Scout", category: "fast" },
      "meta-llama/llama-3.3-70b-instruct": { name: "Llama 3.3 70B", category: "general" }
    }
  },
  openai: {
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKey: () => process.env.OPENAI_API_KEY,
    models: {
      "gpt-6-astra": { name: "GPT-6 Astra", category: "reasoning" },
      "gpt-5.6-sol": { name: "GPT-5.6 Sol", category: "reasoning" },
      "gpt-5.6-terra": { name: "GPT-5.6 Terra", category: "reasoning" },
      "gpt-5.1-codex": { name: "GPT-5.1 Codex", category: "coding" },
      "gpt-4o": { name: "GPT-4o", category: "general" },
      "gpt-4o-mini": { name: "GPT-4o mini", category: "fast" }
    }
  },
  google: {
    label: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    models: {
      "gemini-3.8-flash": { name: "Gemini 3.8 Flash", category: "fast" },
      "gemini-3.7-flash": { name: "Gemini 3.7 Flash", category: "coding" },
      "gemini-3.6-flash": { name: "Gemini 3.6 Flash", category: "fast" },
      "gemini-3.5-flash": { name: "Gemini 3.5 Flash", category: "fast" }
    }
  },
  xai: {
    label: "xAI (Grok)",
    baseURL: "https://api.x.ai/v1",
    apiKey: () => process.env.XAI_API_KEY,
    models: {
      "grok-4.6": { name: "Grok 4.6", category: "coding" },
      "grok-4.5": { name: "Grok 4.5", category: "coding" },
      "grok-4.20-beta": { name: "Grok 4.20 Beta", category: "reasoning" }
    }
  },
  anthropic: {
    label: "Anthropic",
    baseURL: "https://api.anthropic.com/v1",
    apiKey: () => process.env.ANTHROPIC_API_KEY,
    models: {
      "claude-fable-5.1": { name: "Claude Fable 5.1", category: "reasoning" },
      "claude-sonnet-5": { name: "Claude Sonnet 5", category: "general" },
      "claude-opus-5": { name: "Claude Opus 5", category: "reasoning" },
      "claude-sonnet-4": { name: "Claude Sonnet 4", category: "general" }
    }
  },
  groq: {
    // Groq: permanent free tier, no credit card. Great for students.
    // Sign up at https://console.groq.com  -> API Keys -> GROQ_API_KEY.
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: () => process.env.GROQ_API_KEY,
    defaultHeaders: {},
    freeTier: true,
    models: {
      // Verified against Groq's live /models endpoint.
      "openai/gpt-oss-120b": { name: "GPT-OSS 120B", category: "reasoning", options: {} },
      "openai/gpt-oss-20b": { name: "GPT-OSS 20B", category: "general", options: {} },
      "qwen/qwen3.8-27b": { name: "Qwen 3.8 27B", category: "general", options: {} },
      "qwen/qwen3.6-27b": { name: "Qwen 3.6 27B", category: "fast", options: {} }
    }
  },
  mistral: {
    // Mistral free "Experiment" tier: ~1 billion tokens/month, resets monthly.
    // Phone verification required, no credit card. Sign up at https://console.mistral.ai
    // (API keys page) -> MISTRAL_API_KEY.
    label: "Mistral",
    baseURL: "https://api.mistral.ai/v1",
    apiKey: () => process.env.MISTRAL_API_KEY,
    defaultHeaders: {},
    freeTier: true,
    models: {
      "codestral-latest": { name: "Codestral (coding)", category: "coding", options: {} },
      "mistral-small-2603": { name: "Mistral Small 2.6", category: "general", options: {} },
      "mistral-small-latest": { name: "Mistral Small (latest)", category: "general", options: {} },
      "ministral-8b-latest": { name: "Ministral 8B", category: "fast", options: {} },
      "magistral-small-latest": { name: "Magistral Small", category: "reasoning", options: {} },
      "mistral-medium-2604": { name: "Mistral Medium", category: "reasoning", options: {} }
    }
  },
  zai: {
    // Z.ai (Zhipu/GLM): free tier, ~1,000 req/day, no card.
    // Sign up at https://www.z.ai  -> API keys -> ZAI_API_KEY.
    label: "Z.ai (GLM)",
    baseURL: "https://api.z.ai/api/paas/v4",
    apiKey: () => process.env.ZAI_API_KEY,
    defaultHeaders: {},
    freeTier: true,
    models: {
      "glm-5.3-flash": { name: "GLM 5.3 Flash", category: "fast", options: {} },
      "glm-5.3": { name: "GLM 5.3", category: "general", options: {} },
      "glm-5.2": { name: "GLM 5.2", category: "general", options: {} },
      "glm-5": { name: "GLM 5", category: "reasoning", options: {} }
    }
  },
  huggingface: {
    // Hugging Face Inference Providers (OpenAI-compatible router).
    // Token: HF_TOKEN (or HUGGINGFACE_TOKEN) — no card for free models.
    label: "Hugging Face",
    baseURL: "https://router.huggingface.co/v1",
    apiKey: () => process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN,
    defaultHeaders: {},
    freeTier: true,
    models: {
      "Qwen/Qwen3-30B-A3B": { name: "Qwen3 30B A3B", category: "fast", options: {} },
      "meta-llama/Meta-Llama-3.1-8B-Instruct": { name: "Llama 3.1 8B", category: "general", options: {} },
      "mistralai/Mistral-7B-Instruct-v0.3": { name: "Mistral 7B", category: "general", options: {} }
    }
  }
};

const DEFAULT_CONFIG = {
  $comment:
    "myagent config. The model catalog lives in the code; add or override models under provider.<name>.models. Change the default model, permissions, and agent options here.",
  model: "openrouter/openai/gpt-4o",
  provider: {
    ...DEFAULT_PROVIDERS
  },
  permissions: {
    bash: "ask",
    read: "allow",
    write: "ask",
    edit: "ask",
    glob: "allow",
    grep: "allow",
    list: "allow",
    webfetch: "ask"
  },
  agent: {
    maxSteps: 30,
    maxTokens: 4096,
    temperature: undefined,
    systemPrompt: undefined
  }
};

// What actually gets written to disk on first run - a small, human-editable file.
const FRESH_CONFIG_JSON = {
  $comment: "myagent config. Add custom models under provider.<name>.models (full id = provider/model).",
  model: "openrouter/openai/gpt-4o",
  permissions: {
    bash: "ask",
    read: "allow",
    write: "ask",
    edit: "ask",
    glob: "allow",
    grep: "allow",
    list: "allow",
    webfetch: "ask"
  },
  agent: { maxSteps: 30, maxTokens: 4096 },
  provider: {
    custom: {
      label: "Custom (OpenAI-compatible)",
      baseURL: "https://your-endpoint.example.com/v1",
      apiKey: "YOUR_ENV_VAR_OR_KEY",
      models: {}
    }
  }
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadConfig() {
  ensureDir(CONFIG_DIR);
  let user = {};
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(FRESH_CONFIG_JSON, null, 2));
  } else {
    try {
      user = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (err) {
      console.error(`Failed to read config at ${CONFIG_PATH}:`, err.message);
    }
  }
  // The model catalog is owned by the code (DEFAULT_PROVIDERS). The on-disk
  // config only adds/overrides providers, models, permissions, and the default
  // model. Functions can't live in JSON, so we re-attach apiKey resolvers here.
  const config = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), user);
  for (const [pkey, prov] of Object.entries(DEFAULT_PROVIDERS)) {
    if (config.provider[pkey]) config.provider[pkey].apiKey = prov.apiKey;
  }
  return config;
}

function saveConfig(config) {
  ensureDir(CONFIG_DIR);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(deepDiff(DEFAULT_CONFIG, config), null, 2));
}

// Return only the keys where `override` differs from `base`. Lets us keep the
// on-disk config small and to-the-point instead of mirroring the full catalog.
function deepDiff(base, override) {
  const out = {};
  for (const key of Object.keys(override || {})) {
    const b = base ? base[key] : undefined;
    const o = override[key];
    if (isPlainObject(b) && isPlainObject(o)) {
      const sub = deepDiff(b, o);
      if (Object.keys(sub).length) out[key] = sub;
    } else if (JSON.stringify(b) !== JSON.stringify(o)) {
      out[key] = o;
    }
  }
  return out;
}

function deepMerge(base, override) {
  const out = { ...base };
  for (const key of Object.keys(override || {})) {
    const b = base[key];
    const o = override[key];
    if (isPlainObject(b) && isPlainObject(o)) {
      out[key] = deepMerge(b, o);
    } else if (o === undefined) {
      continue;
    } else {
      out[key] = o;
    }
  }
  return out;
}

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function getSessionStore() {
  ensureDir(SESSION_DIR);
  return SESSION_DIR;
}

function resolveProviderKey(providerId, config) {
  const providers = config.provider || config.providers || {};
  if (providers[providerId]) return providerId;
  const alias = Object.keys(providers).find(
    (k) => (providers[k].label || k).toLowerCase() === String(providerId).toLowerCase()
  );
  return alias;
}

function getProvider(config, providerId) {
  const key = resolveProviderKey(providerId, config);
  return key ? config.provider[key] : null;
}

module.exports = {
  CONFIG_DIR,
  CONFIG_PATH,
  SESSION_DIR,
  DEFAULT_PROVIDERS,
  loadConfig,
  saveConfig,
  deepMerge,
  deepDiff,
  getSessionStore,
  getProvider
};