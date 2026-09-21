/* OpenAI-compatible AI provider client + settings.
   Supports: Bearer auth, custom headers (OpenRouter HTTP-Referer/X-Title,
   Azure api-key, org/project scoping), quality params (temperature/top_p/
   max_tokens/penalties/seed), per-request timeouts, and robust /models
   normalization across OpenAI/OpenRouter/Groq/DeepSeek/Mistral/Together/
   Ollama/LM-Studio/custom endpoints. */

const LS_KEY = "aifimora.aiProviders.v1";

export const PRESET_PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    keyHint: "sk-...",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o4-mini"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    keyHint: "sk-or-...",
    models: [
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.0-flash-001",
      "deepseek/deepseek-chat",
    ],
  },
  {
    id: "groq",
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    keyHint: "gsk_...",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    keyHint: "sk-...",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "mistral",
    label: "Mistral",
    baseURL: "https://api.mistral.ai/v1",
    keyHint: "...",
    models: ["mistral-small-latest", "mistral-large-latest", "open-mistral-nemo"],
  },
  {
    id: "together",
    label: "Together",
    baseURL: "https://api.together.xyz/v1",
    keyHint: "...",
    models: ["meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo"],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    baseURL: "http://localhost:11434/v1",
    keyHint: "optional / none",
    models: ["llama3.2", "qwen2.5", "mistral", "phi3"],
    local: true,
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    baseURL: "http://localhost:1234/v1",
    keyHint: "lm-studio",
    models: ["local-model"],
    local: true,
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    baseURL: "",
    keyHint: "any",
    models: [],
  },
];

const ADV_DEFAULTS = {
  temperature: 0.7,
  topP: 1,
  maxTokens: 1024,
  freqPenalty: 0,
  presPenalty: 0,
  seed: "",
  timeoutMs: 60000,
  organization: "",
  headersText: "",
  extraBodyText: "",
};

function providerDefaults(id) {
  const preset = PRESET_PROVIDERS.find((p) => p.id === id);
  const custom = loadCustomProvidersCache()?.find?.((p) => p.id === id);
  const def = preset || custom;
  return {
    baseURL: def?.baseURL ?? "",
    apiKey: id === "lmstudio" ? "lm-studio" : "",
    model: def?.models?.[0] || "gpt-4o-mini",
    ...ADV_DEFAULTS,
  };
}

/* Custom providers live alongside presets (2.2.0). The module-level cache
 * mirrors localStorage so providerDefaults() can resolve custom ids even
 * before loadProviders() runs. */
let customProvidersCache = null;
function loadCustomProvidersCache() {
  if (customProvidersCache) return customProvidersCache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    customProvidersCache = Array.isArray(data?.customProviders) ? data.customProviders : [];
  } catch {
    customProvidersCache = [];
  }
  return customProvidersCache;
}

function defaults() {
  const providers = {};
  for (const p of PRESET_PROVIDERS) providers[p.id] = providerDefaults(p.id);
  providers.custom = { ...providerDefaults("custom"), baseURL: "https://" };
  return { activeId: "openai", providers, modelsCache: {}, customProviders: [], userModels: {} };
}

function sanitizeCustomProviders(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      id: slugify(String(p.id || p.label || "custom")),
      label: String(p.label || "Custom").slice(0, 60) || "Custom",
      baseURL: String(p.baseURL || "").replace(/\/$/, ""),
      keyHint: String(p.keyHint || "any").slice(0, 60),
      models: [...new Set((Array.isArray(p.models) ? p.models : String(p.models || "").split(/[\n,]+/)).map((m) => String(m || "").trim()).filter(Boolean))].slice(0, 200),
      local: !!p.local,
    }))
    .filter((p) => p.id && p.label && p.baseURL)
    .slice(0, 50);
}

function slugify(s) {
  return String(s || "custom")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "custom";
}

function sanitizeUserModels(obj) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (!k) continue;
    const list = [...new Set((Array.isArray(v) ? v : [v]).map((m) => String(m || "").trim()).filter(Boolean))].slice(0, 200);
    if (list.length) out[k] = list;
  }
  return out;
}

export function loadProviders() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      customProvidersCache = [];
      return defaults();
    }
    const data = JSON.parse(raw);
    const d = defaults();
    const customProviders = sanitizeCustomProviders(data.customProviders || []);
    customProvidersCache = customProviders;
    const providers = { ...d.providers };
    for (const [id, conf] of Object.entries(data.providers || {})) {
      providers[id] = { ...providerDefaults(id), ...(conf || {}) };
    }
    // Ensure every custom provider has a config slot.
    for (const c of customProviders) {
      if (!providers[c.id]) providers[c.id] = { ...providerDefaults(c.id), baseURL: c.baseURL };
    }
    return {
      activeId: data.activeId || d.activeId,
      providers,
      modelsCache: data.modelsCache || {},
      customProviders,
      userModels: sanitizeUserModels(data.userModels || {}),
    };
  } catch {
    customProvidersCache = [];
    return defaults();
  }
}

export function saveProviders(cfg) {
  try {
    customProvidersCache = Array.isArray(cfg?.customProviders) ? cfg.customProviders : customProvidersCache;
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  } catch { /* quota / private mode */ }
}

export function getActiveProvider() {
  const cfg = loadProviders();
  const id = cfg.activeId;
  const all = listProviderDefs(cfg);
  const preset = all.find((p) => p.id === id) || PRESET_PROVIDERS[0];
  const conf = { ...providerDefaults(id), ...(cfg.providers[id] || {}) };
  const cached = cfg.modelsCache?.[id]?.models || [];
  const userAdded = cfg.userModels?.[id] || [];
  const models = [...new Set([...(cached || []), ...userAdded, ...(preset.models || [])])];
  return {
    id,
    label: preset.label,
    baseURL: String(conf.baseURL || preset.baseURL || "").replace(/\/$/, ""),
    apiKey: conf.apiKey || "",
    model: conf.model || models[0] || "gpt-4o-mini",
    local: !!preset.local,
    custom: !PRESET_PROVIDERS.some((p) => p.id === id),
    models,
    cachedModels: cached || [],
    userModels: userAdded || [],
    modelsCachedAt: cfg.modelsCache?.[id]?.at || 0,
    temperature: clampNum(conf.temperature, 0, 2, 0.7),
    topP: clampNum(conf.topP, 0, 1, 1),
    maxTokens: Math.max(1, Math.min(128000, parseInt(conf.maxTokens, 10) || 1024)),
    freqPenalty: clampNum(conf.freqPenalty, -2, 2, 0),
    presPenalty: clampNum(conf.presPenalty, -2, 2, 0),
    seed: conf.seed === "" || conf.seed == null ? "" : Math.max(0, parseInt(conf.seed, 10) || 0),
    timeoutMs: Math.max(5000, Math.min(600000, parseInt(conf.timeoutMs, 10) || 60000)),
    organization: String(conf.organization || ""),
    headersText: String(conf.headersText || ""),
    extraBodyText: String(conf.extraBodyText || ""),
  };
}

function clampNum(v, lo, hi, fb) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.max(lo, Math.min(hi, n));
}

export function isAIConfigured() {
  const p = getActiveProvider();
  if (!p.baseURL) return false;
  if (p.local) return true;
  return !!p.apiKey;
}

/** Parse custom headers: JSON object OR "Name: value" lines. */
export function parseCustomHeaders(text) {
  const out = {};
  const t = String(text || "").trim();
  if (!t) return out;
  // Try JSON first: { "X-Foo": "bar" } or [{ "name":..,"value":.. }]
  try {
    const j = JSON.parse(t);
    if (Array.isArray(j)) {
      for (const e of j) {
        if (e?.name && e.value != null) out[String(e.name)] = String(e.value);
      }
      return out;
    }
    if (j && typeof j === "object") {
      for (const [k, v] of Object.entries(j)) out[String(k)] = String(v);
      return out;
    }
  } catch { /* fall through to line format */ }
  for (const line of t.split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf(":");
    if (i < 1) continue;
    const name = s.slice(0, i).trim();
    const value = s.slice(i + 1).trim();
    if (name && value) out[name] = value;
  }
  return out;
}

/** Parse extra JSON body merged into chat requests (returns {} on error). */
export function parseExtraBody(text) {
  const t = String(text || "").trim();
  if (!t) return {};
  try {
    const j = JSON.parse(t);
    if (j && typeof j === "object" && !Array.isArray(j)) return j;
  } catch { /* invalid -> ignored, surfaced in UI hint */ }
  return {};
}

/** Build request headers: auth + org + provider quirks + custom. */
export function buildHeaders(p, custom = {}) {
  const headers = { "Content-Type": "application/json", ...custom };
  const key = p.apiKey;
  if (key) {
    // Azure-style endpoints expect `api-key`, everything else Bearer.
    if (/\.openai\.azure\.com|azure/i.test(p.baseURL)) headers["api-key"] = key;
    else headers.Authorization = `Bearer ${key}`;
  }
  if (p.organization) headers["OpenAI-Organization"] = p.organization;
  const merged = { ...parseCustomHeaders(p.headersText), ...headers };
  // OpenRouter attribution (docs recommend; harmless elsewhere if absent)
  if (/openrouter\.ai/i.test(p.baseURL || "")) {
    if (!merged["HTTP-Referer"] && !merged["http-referer"]) {
      try {
        merged["HTTP-Referer"] = window.location?.origin || "https://aifilmora.local";
      } catch {
        merged["HTTP-Referer"] = "https://aifilmora.local";
      }
    }
    if (!merged["X-Title"]) merged["X-Title"] = "AiFilmora";
  }
  return merged;
}

function withTimeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error(`Timed out after ${ms}ms`)), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

/**
 * Non-streaming chat completion against an OpenAI-compatible endpoint.
 * Returns { ok, content?, error?, raw?, usage? }
 */
export async function chatComplete({ messages, model, baseURL, apiKey, temperature, topP, maxTokens, freqPenalty, presPenalty, seed, timeoutMs, extraBody } = {}) {
  const p = getActiveProvider();
  const url = `${(baseURL || p.baseURL || "").replace(/\/$/, "")}/chat/completions`;
  if (!baseURL && !p.baseURL) return { ok: false, error: "Set a Base URL first" };
  const mdl = model || p.model;
  const key = apiKey != null ? apiKey : p.apiKey;

  const headers = buildHeaders({ ...p, apiKey: key, baseURL: baseURL || p.baseURL });
  const extra = extraBody !== undefined ? extraBody : parseExtraBody(p.extraBodyText);
  const body = {
    model: mdl,
    messages,
    temperature: temperature ?? p.temperature,
    top_p: topP ?? p.topP,
    max_tokens: maxTokens ?? p.maxTokens,
    frequency_penalty: freqPenalty ?? p.freqPenalty,
    presence_penalty: presPenalty ?? p.presPenalty,
    ...(seed !== undefined ? (seed === "" ? {} : { seed }) : (p.seed === "" ? {} : { seed: p.seed })),
    ...(extra || {}),
  };

  const ms = timeoutMs ?? p.timeoutMs;
  const { signal, done } = withTimeout(ms);
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j.error?.message || JSON.stringify(j).slice(0, 300);
      } catch {
        detail = await res.text().catch(() => "");
        detail = String(detail || "").slice(0, 300);
      }
      return { ok: false, error: `${res.status} ${detail || res.statusText}` };
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    return { ok: true, content, raw: json, usage: json.usage };
  } catch (e) {
    if (String(e?.name) === "AbortError") return { ok: false, error: `Timed out after ${ms}ms — raise Timeout in AI settings` };
    return { ok: false, error: e.message || "Network/CORS error" };
  } finally {
    done();
  }
}

/** Streaming chat with SSE-ish parsing. onDelta(text) called for each chunk. */
export async function chatStream({ messages, model, baseURL, apiKey, temperature, topP, maxTokens, onDelta, timeoutMs, extraBody } = {}) {
  const p = getActiveProvider();
  const url = `${(baseURL || p.baseURL || "").replace(/\/$/, "")}/chat/completions`;
  if (!baseURL && !p.baseURL) return { ok: false, error: "Set a Base URL first" };
  const mdl = model || p.model;
  const key = apiKey != null ? apiKey : p.apiKey;
  const headers = buildHeaders({ ...p, apiKey: key, baseURL: baseURL || p.baseURL });
  const extra = extraBody !== undefined ? extraBody : parseExtraBody(p.extraBodyText);
  const ms = Math.max(timeoutMs ?? p.timeoutMs, 60000);
  const { signal, done } = withTimeout(ms);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model: mdl,
        messages,
        temperature: temperature ?? p.temperature,
        top_p: topP ?? p.topP,
        max_tokens: maxTokens ?? p.maxTokens,
        ...(extra || {}),
        stream: true,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${String(t).slice(0, 300)}` };
    }
    if (!res.body) return { ok: false, error: "No response body" };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let full = "";
    while (true) {
      const { done: end, value } = await reader.read();
      if (end) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() || "";
      for (const line of parts) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const data = s.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta?.content || "";
          if (delta) {
            full += delta;
            onDelta?.(delta);
          }
        } catch {
          /* ignore partial */
        }
      }
    }
    return { ok: true, content: full };
  } catch (e) {
    if (String(e?.name) === "AbortError") return { ok: false, error: `Stream timed out after ${ms}ms` };
    return { ok: false, error: e.message || "Network/CORS error" };
  } finally {
    done();
  }
}

/** Normalize the many /models response shapes to string[]. */
export function normalizeModelList(json) {
  if (!json) return [];
  if (Array.isArray(json)) {
    return json.map((m) => (typeof m === "string" ? m : m?.id || m?.name)).filter(Boolean);
  }
  const pools = [
    json.data,
    json.models,
    json.model_list,
    json.result,
  ];
  for (const pool of pools) {
    if (Array.isArray(pool)) {
      const ids = pool.map((m) => (typeof m === "string" ? m : m?.id || m?.name || m?.model)).filter(Boolean);
      if (ids.length) return [...new Set(ids.map(String))];
    }
  }
  if (json.id || json.name) return [String(json.id || json.name)];
  return [];
}

/**
 * GET /models against the CURRENT FORM (or active provider) to validate
 * connectivity. Pass explicit { baseURL, apiKey, headersText } to test
 * unsaved form values. Caches per provider id.
 */
export async function listModels(override = {}) {
  const p = getActiveProvider();
  const baseURL = (override.baseURL ?? p.baseURL ?? "").replace(/\/$/, "");
  if (!baseURL) return { ok: false, error: "Set a Base URL first (e.g. https://api.openai.com/v1)" };
  const key = override.apiKey ?? p.apiKey;
  const headersText = override.headersText ?? p.headersText;
  const organization = override.organization ?? p.organization;
  const url = `${baseURL}/models`;
  const headers = buildHeaders({ ...p, baseURL, apiKey: key, headersText, organization });
  delete headers["Content-Type"];
  const ms = override.timeoutMs ?? p.timeoutMs;
  const { signal, done } = withTimeout(ms);
  try {
    const res = await fetch(url, { headers, signal });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${String(t).slice(0, 200) || res.statusText}` };
    }
    const json = await res.json().catch(() => null);
    let ids = normalizeModelList(json);
    ids = [...new Set(ids.map(String))].sort((a, b) => a.localeCompare(b));
    if (!ids.length) return { ok: false, error: "Endpoint answered but listed zero models" };
    // Cache under the active provider id for the dropdown
    try {
      const cfg = loadProviders();
      cfg.modelsCache = cfg.modelsCache || {};
      cfg.modelsCache[p.id] = { models: ids, at: Date.now() };
      saveProviders(cfg);
    } catch { /* cache is best-effort */ }
    return { ok: true, models: ids };
  } catch (e) {
    if (String(e?.name) === "AbortError") return { ok: false, error: `Timed out after ${ms}ms — check Base URL / proxy / CORS` };
    return { ok: false, error: e.message || "Network/CORS error — browsers block some providers; use Electron or a local proxy" };
  } finally {
    done();
  }
}

/** Run a structured AI editing action via the active provider. */
export async function aiComplete(prompt, { system } = {}) {
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  return chatComplete({ messages });
}

/* ---------------- Custom providers & custom models (2.2.0) ---------------- */

/** All provider definitions: built-in presets + user-added custom endpoints. */
export function listProviderDefs(cfg) {
  const c = cfg || loadProviders();
  return [...PRESET_PROVIDERS, ...(c.customProviders || [])];
}

export function isCustomProvider(id) {
  return !PRESET_PROVIDERS.some((p) => p.id === id);
}

function uniqueCustomId(label, existing) {
  let base = slugify(label || "custom") || "custom";
  if (PRESET_PROVIDERS.some((p) => p.id === base)) base = `${base}-custom`;
  let id = base;
  let n = 2;
  const taken = new Set([...PRESET_PROVIDERS.map((p) => p.id), ...(existing || []).map((p) => p.id)]);
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

/**
 * Add a user-defined OpenAI-compatible provider.
 * Returns { ok, provider?, error? }.
 */
export function addCustomProvider({ label, baseURL, keyHint, models, local } = {}) {
  const name = String(label || "").trim();
  const url = String(baseURL || "").trim().replace(/\/$/, "");
  if (!name) return { ok: false, error: "Give the provider a name" };
  if (!url) return { ok: false, error: "Set a Base URL (e.g. https://my-host:8000/v1)" };
  if (!/^https?:\/\//i.test(url) && !/^http:\/\/localhost/i.test(url)) {
    return { ok: false, error: "Base URL should start with http(s)://" };
  }
  const cfg = loadProviders();
  const id = uniqueCustomId(name, cfg.customProviders);
  const modelList = [...new Set(
    (Array.isArray(models) ? models : String(models || "").split(/[\n,]+/))
      .map((m) => String(m || "").trim()).filter(Boolean)
  )].slice(0, 200);
  const provider = {
    id,
    label: name.slice(0, 60),
    baseURL: url,
    keyHint: String(keyHint || "any").slice(0, 60) || "any",
    models: modelList,
    local: !!local,
  };
  cfg.customProviders = [...(cfg.customProviders || []), provider];
  cfg.providers[id] = { ...providerDefaults(id), baseURL: url, model: modelList[0] || "gpt-4o-mini" };
  customProvidersCache = cfg.customProviders;
  saveProviders(cfg);
  return { ok: true, provider };
}

/** Update a custom provider's definition (built-ins are read-only). */
export function updateCustomProvider(id, patch = {}) {
  if (!isCustomProvider(id)) return { ok: false, error: "Built-in providers cannot be edited" };
  const cfg = loadProviders();
  const i = (cfg.customProviders || []).findIndex((p) => p.id === id);
  if (i < 0) return { ok: false, error: "Provider not found" };
  const cur = cfg.customProviders[i];
  const next = { ...cur };
  if (patch.label !== undefined) {
    const name = String(patch.label || "").trim();
    if (!name) return { ok: false, error: "Name cannot be empty" };
    next.label = name.slice(0, 60);
  }
  if (patch.baseURL !== undefined) {
    const url = String(patch.baseURL || "").trim().replace(/\/$/, "");
    if (!url) return { ok: false, error: "Base URL cannot be empty" };
    next.baseURL = url;
    if (cfg.providers[id]) cfg.providers[id].baseURL = url;
  }
  if (patch.keyHint !== undefined) next.keyHint = String(patch.keyHint || "any").slice(0, 60);
  if (patch.local !== undefined) next.local = !!patch.local;
  if (patch.models !== undefined) {
    next.models = [...new Set(
      (Array.isArray(patch.models) ? patch.models : String(patch.models || "").split(/[\n,]+/))
        .map((m) => String(m || "").trim()).filter(Boolean)
    )].slice(0, 200);
  }
  cfg.customProviders[i] = next;
  customProvidersCache = cfg.customProviders;
  saveProviders(cfg);
  return { ok: true, provider: next };
}

/** Delete a custom provider (plus its stored key, models cache, user models). */
export function removeCustomProvider(id) {
  if (!isCustomProvider(id)) return { ok: false, error: "Built-in providers cannot be deleted" };
  const cfg = loadProviders();
  if (!(cfg.customProviders || []).some((p) => p.id === id)) return { ok: false, error: "Provider not found" };
  cfg.customProviders = (cfg.customProviders || []).filter((p) => p.id !== id);
  if (cfg.providers?.[id]) delete cfg.providers[id];
  if (cfg.modelsCache?.[id]) delete cfg.modelsCache[id];
  if (cfg.userModels?.[id]) delete cfg.userModels[id];
  if (cfg.activeId === id) cfg.activeId = "openai";
  customProvidersCache = cfg.customProviders;
  saveProviders(cfg);
  return { ok: true };
}

/** Add a custom model id to any provider (built-in or custom). */
export function addCustomModel(providerId, modelId) {
  const m = String(modelId || "").trim();
  if (!m) return { ok: false, error: "Enter a model id" };
  if (/\s/.test(m)) return { ok: false, error: "Model ids cannot contain spaces" };
  const cfg = loadProviders();
  const all = listProviderDefs(cfg);
  if (!all.some((p) => p.id === providerId)) return { ok: false, error: "Provider not found" };
  cfg.userModels = cfg.userModels || {};
  const list = [...new Set([...(cfg.userModels[providerId] || []), m])].slice(0, 200);
  cfg.userModels[providerId] = list;
  // Point the provider at the new model right away.
  cfg.providers[providerId] = { ...(cfg.providers[providerId] || providerDefaults(providerId)), model: m };
  saveProviders(cfg);
  return { ok: true, models: list };
}

/** Remove a user-added model from a provider. */
export function removeCustomModel(providerId, modelId) {
  const cfg = loadProviders();
  const list = (cfg.userModels?.[providerId] || []).filter((m) => m !== modelId);
  cfg.userModels = cfg.userModels || {};
  if (list.length) cfg.userModels[providerId] = list;
  else delete cfg.userModels[providerId];
  // If the active model was deleted, fall back to the first known model.
  const conf = cfg.providers?.[providerId];
  if (conf && conf.model === modelId) {
    const def = listProviderDefs(cfg).find((p) => p.id === providerId);
    conf.model = list[0] || def?.models?.[0] || "gpt-4o-mini";
  }
  saveProviders(cfg);
  return { ok: true, models: list };
}
