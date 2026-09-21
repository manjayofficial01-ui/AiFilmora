/* AI Provider settings UI — model dropdown, quality params, headers */
import {
  PRESET_PROVIDERS,
  loadProviders,
  saveProviders,
  getActiveProvider,
  listModels,
  listProviderDefs,
  isCustomProvider,
  addCustomProvider,
  updateCustomProvider,
  removeCustomProvider,
  addCustomModel,
  removeCustomModel,
  chatComplete,
  isAIConfigured,
  parseExtraBody,
} from "./ai-providers.js";
import { toast } from "./media.js";

function $(id) {
  return document.getElementById(id);
}

export function initAISettings() {
  const sel = $("aiProviderSelect");
  if (!sel) return;

  refreshProviderDropdown();

  const cfg = loadProviders();
  sel.value = cfg.activeId;
  fillForm();
  renderCustomProviders();
  renderUserModels();

  sel.addEventListener("change", () => {
    const c = loadProviders();
    c.activeId = sel.value;
    saveProviders(c);
    fillForm();
    renderCustomProviders();
    renderUserModels();
    updateStatusChip();
  });

  // Persist on edit (input for sliders/numbers/text, change for selects)
  for (const id of ["aiBaseURL", "aiApiKey", "aiModel", "aiMaxTokens", "aiSeed", "aiOrg", "aiHeaders", "aiExtraBody"]) {
    $(id)?.addEventListener("input", () => writeFormToStore());
    $(id)?.addEventListener("change", () => writeFormToStore());
  }
  for (const id of ["aiTemp", "aiTopP", "aiFreq", "aiPres", "aiTimeout", "aiModelSelect"]) {
    $(id)?.addEventListener("input", () => writeFormToStore());
    $(id)?.addEventListener("change", () => writeFormToStore());
  }
  $("aiApiKey")?.addEventListener("blur", () => writeFormToStore());

  // Picking from the fetched-model dropdown fills the Model input
  $("aiModelSelect")?.addEventListener("change", () => {
    const dd = $("aiModelSelect");
    const input = $("aiModel");
    if (dd && input && dd.value) {
      input.value = dd.value;
      writeFormToStore();
    }
  });
  // Typing a custom model keeps the dropdown in sync when it matches
  $("aiModel")?.addEventListener("input", () => {
    const dd = $("aiModelSelect");
    const input = $("aiModel");
    if (dd && input && [...dd.options].some((o) => o.value === input.value)) {
      dd.value = input.value;
    }
  });

  $("btnAIListModels")?.addEventListener("click", async () => {
    writeFormToStore();
    const el = $("aiProviderStatus");
    const btn = $("btnAIListModels");
    if (el) el.textContent = "Checking /models…";
    if (btn) btn.disabled = true;
    try {
      // Use live form values so unsaved edits are tested, not stale storage
      const res = await listModels({
        baseURL: $("aiBaseURL")?.value?.trim(),
        apiKey: $("aiApiKey")?.value ?? "",
        headersText: $("aiHeaders")?.value ?? "",
        organization: $("aiOrg")?.value?.trim() ?? "",
      });
      if (!res.ok) {
        if (el) el.textContent = "Failed: " + res.error;
        toast("Could not list models", "err");
        return;
      }
      if (el) el.textContent = `OK · ${res.models.length} models`;
      populateModelDropdown(res.models, { preferCurrent: true });
      writeFormToStore();
      toast(`Found ${res.models.length} models — pick one in the Model list`, "ok");
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  $("btnAITest")?.addEventListener("click", async () => {
    writeFormToStore();
    const el = $("aiProviderStatus");
    if (el) el.textContent = "Sending test completion…";
    const res = await chatComplete({
      messages: [
        { role: "system", content: "Reply with exactly: AiFimora AI ready" },
        { role: "user", content: "ping" },
      ],
      maxTokens: 32,
    });
    if (!res.ok) {
      if (el) el.textContent = "Error: " + res.error;
      toast("AI test failed — check key / CORS / base URL", "err");
      return;
    }
    if (el) el.textContent = "OK · " + (res.content || "").slice(0, 80);
    toast("AI provider connected", "ok");
  });

  $("btnAIClearKey")?.addEventListener("click", () => {
    const c = loadProviders();
    const id = c.activeId;
    if (c.providers[id]) c.providers[id].apiKey = "";
    saveProviders(c);
    fillForm();
    updateStatusChip();
    toast("API key cleared for this provider");
  });

  // ---- 2.2.0: custom provider + custom model configuration ----
  $("btnAIAddProvider")?.addEventListener("click", () => {
    const res = addCustomProvider({
      label: $("aiCustomName")?.value || "",
      baseURL: $("aiCustomBaseURL")?.value || "",
      keyHint: $("aiCustomKeyHint")?.value || "any",
      models: $("aiCustomModels")?.value || "",
      local: !!$("aiCustomLocal")?.checked,
    });
    if (!res.ok) {
      toast(res.error || "Could not add provider", "err");
      return;
    }
    const c = loadProviders();
    c.activeId = res.provider.id;
    saveProviders(c);
    refreshProviderDropdown();
    sel.value = res.provider.id;
    fillForm();
    renderCustomProviders();
    renderUserModels();
    updateStatusChip();
    if ($("aiCustomName")) $("aiCustomName").value = "";
    if ($("aiCustomBaseURL")) $("aiCustomBaseURL").value = "";
    if ($("aiCustomModels")) $("aiCustomModels").value = "";
    toast(`Provider “${res.provider.label}” added`, "ok");
  });

  $("btnAINewModel")?.addEventListener("click", () => {
    const input = $("aiNewModel");
    const m = input?.value?.trim() || "";
    if (!m) {
      toast("Enter a model id first", "err");
      input?.focus();
      return;
    }
    const c = loadProviders();
    const res = addCustomModel(c.activeId, m);
    if (!res.ok) {
      toast(res.error || "Could not add model", "err");
      return;
    }
    if (input) input.value = "";
    fillForm();
    renderUserModels();
    updateStatusChip();
    toast(`Model “${m}” added to this provider`, "ok");
  });
  $("aiNewModel")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("btnAINewModel")?.click();
    }
  });

  updateStatusChip();
  window.addEventListener("aifimora:ai-configured", updateStatusChip);
}

/** Rebuild the provider dropdown from presets + user custom providers. */
function refreshProviderDropdown() {
  const sel = $("aiProviderSelect");
  if (!sel) return;
  const defs = listProviderDefs();
  const cur = sel.value || loadProviders().activeId;
  sel.innerHTML = defs.map(
    (p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.label)}${isCustomProvider(p.id) ? " · custom" : ""}</option>`
  ).join("");
  if (defs.some((p) => p.id === cur)) sel.value = cur;
}

/** Fill dropdown + datalist from a model list; keep current model if present. */
function populateModelDropdown(models, { preferCurrent = false } = {}) {
  const dd = $("aiModelSelect");
  const input = $("aiModel");
  const list = $("aiModelList");
  const count = $("aiModelCount");
  const ids = [...new Set((models || []).map(String))].sort((a, b) => a.localeCompare(b));
  if (list) {
    list.innerHTML = ids.slice(0, 500).map((m) => `<option value="${escapeAttr(m)}"></option>`).join("");
  }
  if (dd) {
    dd.innerHTML = ids.map((m) => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join("");
    const current = input?.value?.trim();
    if (preferCurrent && current && ids.includes(current)) dd.value = current;
    else if (ids.length) {
      // Adopt first fetched model only when current input is empty/unknown
      if (!current || !ids.includes(current)) {
        if (input) input.value = ids[0];
        dd.value = ids[0];
      } else dd.value = current;
    }
  }
  if (count) {
    count.textContent = ids.length
      ? `${ids.length} model${ids.length === 1 ? "" : "s"} available — select to use.`
      : "Endpoint listed zero models.";
  }
}

function fillForm() {
  const p = getActiveProvider();
  const set = (id, v) => { const el = $(id); if (el) el.value = v ?? ""; };
  set("aiBaseURL", p.baseURL);
  set("aiApiKey", p.apiKey);
  set("aiModel", p.model);
  set("aiTemp", p.temperature);
  set("aiTopP", p.topP);
  set("aiMaxTokens", p.maxTokens);
  set("aiFreq", p.freqPenalty);
  set("aiPres", p.presPenalty);
  set("aiSeed", p.seed === "" ? "" : p.seed);
  set("aiOrg", p.organization);
  set("aiHeaders", p.headersText);
  set("aiExtraBody", p.extraBodyText);
  const timeout = $("aiTimeout");
  if (timeout) {
    const opts = [...timeout.options].map((o) => o.value);
    timeout.value = opts.includes(String(p.timeoutMs)) ? String(p.timeoutMs) : "60000";
  }
  syncOutputs();
  // Dropdown: cached/fetched models first, presets as fallback
  populateModelDropdown(p.models?.length ? p.models : [p.model].filter(Boolean), { preferCurrent: true });
  // User-added models are merged into p.models already; note them in the count.
  const userCount = p.userModels?.length || 0;
  const count = $("aiModelCount");
  if (count && !(p.cachedModels?.length)) {
    const preset = listProviderDefs().find((x) => x.id === p.id);
    count.textContent = (preset?.models?.length || p.custom || userCount)
      ? (p.custom && !preset?.models?.length && !userCount
        ? "Custom endpoint — click List models to fetch its catalog, or add model ids below."
        : `${p.models.length} model${p.models.length === 1 ? "" : "s"}${userCount ? ` (${userCount} custom)` : ""} — click List models to refresh from endpoint.`)
      : count.textContent;
  } else if (count && p.cachedModels?.length) {
    const when = p.modelsCachedAt ? new Date(p.modelsCachedAt).toLocaleTimeString() : "";
    count.textContent = `${p.cachedModels.length} fetched model${p.cachedModels.length === 1 ? "" : "s"}${when ? " · updated " + when : ""}${userCount ? ` + ${userCount} custom` : ""} — select to use.`;
  }

  const hint = $("aiKeyHint");
  if (hint) {
    const preset = listProviderDefs().find((x) => x.id === p.id);
    hint.textContent = p.local
      ? "Local provider — API key usually optional."
      : `Key looks like: ${preset?.keyHint || "provider key"}`;
  }
  const st = $("aiProviderStatus");
  if (st) {
    st.textContent = isAIConfigured()
      ? `Active: ${p.label} · ${p.model}`
      : p.local
        ? `Local: ${p.baseURL}`
        : "Add an API key to enable real AI";
  }
  validateExtraBody();
}

function syncOutputs() {
  const pairs = [
    ["aiTemp", "aiTempOut"],
    ["aiTopP", "aiTopPOut"],
    ["aiFreq", "aiFreqOut"],
    ["aiPres", "aiPresOut"],
  ];
  for (const [a, b] of pairs) {
    const input = $(a);
    const out = $(b);
    if (input && out) out.textContent = String(input.value);
  }
}

function validateExtraBody() {
  const hint = $("aiExtraBodyHint");
  if (!hint) return;
  const t = ($("aiExtraBody")?.value || "").trim();
  if (!t) { hint.textContent = ""; return; }
  const parsed = parseExtraBody(t);
  if (parsed && Object.keys(parsed).length) {
    hint.textContent = `Merges ${Object.keys(parsed).length} key${Object.keys(parsed).length === 1 ? "" : "s"}: ${Object.keys(parsed).join(", ")}`;
    hint.style.color = "var(--muted)";
  } else {
    hint.textContent = "Not valid JSON object — ignored until fixed.";
    hint.style.color = "#ff9d9d";
  }
}

function writeFormToStore() {
  const c = loadProviders();
  const id = c.activeId;
  const conf = c.providers[id] || {};
  const num = (v, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  // Dropdown wins when it has a value (it mirrors the input anyway)
  const ddVal = $("aiModelSelect")?.value?.trim();
  const inputVal = $("aiModel")?.value?.trim();
  c.providers[id] = {
    ...conf,
    baseURL: $("aiBaseURL")?.value?.trim() || conf.baseURL,
    apiKey: $("aiApiKey")?.value ?? "",
    model: inputVal || ddVal || conf.model,
    temperature: num($("aiTemp")?.value, 0.7),
    topP: num($("aiTopP")?.value, 1),
    maxTokens: Math.max(1, parseInt($("aiMaxTokens")?.value, 10) || 1024),
    freqPenalty: num($("aiFreq")?.value, 0),
    presPenalty: num($("aiPres")?.value, 0),
    seed: ($("aiSeed")?.value ?? "") === "" ? "" : Math.max(0, parseInt($("aiSeed").value, 10) || 0),
    timeoutMs: parseInt($("aiTimeout")?.value, 10) || 60000,
    organization: $("aiOrg")?.value?.trim() || "",
    headersText: $("aiHeaders")?.value ?? "",
    extraBodyText: $("aiExtraBody")?.value ?? "",
  };
  saveProviders(c);
  syncOutputs();
  validateExtraBody();
  updateStatusChip();
  window.dispatchEvent(new CustomEvent("aifimora:ai-configured"));
}

function updateStatusChip() {
  const chip = $("aiModeChip");
  const p = getActiveProvider();
  if (!chip) return;
  if (isAIConfigured()) {
    chip.textContent = `AI: ${p.label}`;
    chip.dataset.mode = "live";
  } else {
    chip.textContent = "AI: Simulated";
    chip.dataset.mode = "sim";
  }
}

/** List user-added custom providers with Use / Delete actions. */
function renderCustomProviders() {
  const root = $("aiCustomList");
  if (!root) return;
  const cfg = loadProviders();
  const customs = cfg.customProviders || [];
  root.innerHTML = "";
  if (!customs.length) {
    root.innerHTML = `<div class="muted-note" style="margin:0">No custom providers yet — add your endpoint above.</div>`;
    return;
  }
  customs.forEach((p) => {
    const row = document.createElement("div");
    row.className = "lut-row";
    const active = cfg.activeId === p.id;
    row.innerHTML = `<span class="name" title="${escapeAttr(p.baseURL)}"></span>
      <span style="font-size:10px;color:var(--muted)">${escapeHtml((p.models || []).length + " models")}${p.local ? " · local" : ""}${active ? " · active" : ""}</span>`;
    row.querySelector(".name").textContent = `${p.label} · ${p.baseURL}`;
    const use = document.createElement("button");
    use.className = "btn sm";
    use.textContent = active ? "Active" : "Use";
    use.disabled = active;
    use.addEventListener("click", () => {
      const c = loadProviders();
      c.activeId = p.id;
      saveProviders(c);
      const sel = $("aiProviderSelect");
      if (sel) sel.value = p.id;
      fillForm();
      renderCustomProviders();
      renderUserModels();
      updateStatusChip();
    });
    const del = document.createElement("button");
    del.className = "btn sm danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm(`Delete custom provider “${p.label}”? Its stored key is removed too.`)) return;
      const res = removeCustomProvider(p.id);
      if (!res.ok) {
        toast(res.error || "Could not delete", "err");
        return;
      }
      refreshProviderDropdown();
      const sel = $("aiProviderSelect");
      if (sel) sel.value = loadProviders().activeId;
      fillForm();
      renderCustomProviders();
      renderUserModels();
      updateStatusChip();
      toast(`Provider “${p.label}” deleted`, "ok");
    });
    row.appendChild(use);
    row.appendChild(del);
    root.appendChild(row);
  });
}

/** List user-added model ids for the active provider with remove buttons. */
function renderUserModels() {
  const root = $("aiUserModels");
  if (!root) return;
  const p = getActiveProvider();
  const list = p.userModels || [];
  root.innerHTML = "";
  if (!list.length) {
    root.innerHTML = `<div class="muted-note" style="margin:0">No custom models on ${escapeHtml(p.label)} yet.</div>`;
    return;
  }
  list.forEach((m) => {
    const row = document.createElement("div");
    row.className = "lut-row";
    row.innerHTML = `<span class="name"></span>${m === p.model ? '<span style="font-size:10px;color:var(--gen)">in use</span>' : ""}`;
    row.querySelector(".name").textContent = m;
    const use = document.createElement("button");
    use.className = "btn sm";
    use.textContent = "Use";
    use.disabled = m === p.model;
    use.addEventListener("click", () => {
      const c = loadProviders();
      c.providers[p.id] = { ...(c.providers[p.id] || {}), model: m };
      saveProviders(c);
      fillForm();
      renderUserModels();
      updateStatusChip();
    });
    const del = document.createElement("button");
    del.className = "btn sm danger";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      removeCustomModel(p.id, m);
      fillForm();
      renderUserModels();
      updateStatusChip();
    });
    row.appendChild(use);
    row.appendChild(del);
    root.appendChild(row);
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
