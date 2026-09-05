const RETRYABLE = new Set(["rate_limit", "timeout", "server", "network"]);

function classifyError(err, provider) {
  const raw =
    err?.error?.message ||
    err?.message ||
    String(err);
  const status =
    typeof err?.status === "number" ? err.status :
    typeof err?.code === "number" ? err.code :
    null;
  const lower = raw.toLowerCase();
  const retryAfter = parseRetryAfter(err);

  if (status === 401 || status === 403)
    return { kind: "auth", label: "Authentication failed", retryable: false, retryAfter: 0 };
  if (status === 402 || /insufficient|credit|balance|budget|quota exceeded/i.test(lower))
    return { kind: "quota", label: "Insufficient credits or quota", retryable: false, retryAfter: 0 };
  if (status === 404)
    return { kind: "not_found", label: "Model not found or unavailable", retryable: false, retryAfter: 0 };
  if (status === 429)
    return { kind: "rate_limit", label: "Rate limited", retryable: true, retryAfter };
  if (status === 408 || /timeout|timed out|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(lower))
    return { kind: "timeout", label: "Request timed out", retryable: true, retryAfter: retryAfter || 3 };
  if (typeof status === "number" && status >= 500)
    return { kind: "server", label: `Server error (${status})`, retryable: true, retryAfter: retryAfter || 5 };
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ENETUNREACH|EAI_AGAIN|fetch failed/i.test(lower))
    return { kind: "network", label: "Network or DNS error", retryable: true, retryAfter: 5 };
  if (/tool[_ ]?calls?|function[_ ]?calls?/i.test(lower) && /not support|not available|incompatible/i.test(lower))
    return { kind: "capability", label: "Model does not support tool calling", retryable: false, retryAfter: 0 };
  if (/5400|more credits|fewer max_tokens|can only afford/i.test(lower))
    return { kind: "quota", label: "Insufficient output budget", retryable: false, retryAfter: 0 };

  return { kind: "unknown", label: raw.slice(0, 120), retryable: false, retryAfter: 0 };
}

function parseRetryAfter(err) {
  try {
    const h = err?.headers;
    if (!h) return 0;
    const val = typeof h["retry-after"] === "string" ? parseInt(h["retry-after"], 10) :
               typeof h.get === "function" ? parseInt(h.get("retry-after"), 10) : 0;
    return Number.isFinite(val) && val > 0 ? Math.min(val, 30) : 0;
  } catch { return 0; }
}

function formatProviderError(classification, providerId, modelId) {
  const { label, kind } = classification;
  const lines = [
    "",
    "  ⚠ Request failed",
    `  Provider: ${providerId}`,
    `  Model:    ${modelId}`,
    `  Reason:   ${label} (${kind})`,
  ];
  return lines.join("\n");
}

module.exports = { classifyError, formatProviderError, RETRYABLE };
