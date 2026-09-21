# F6: OpenAI-compatible chat/completions APIs for AiFimora AI features layer

Research date: 2026-09-14
Scope: provider presets for a desktop (Electron) video editor AI agent — tool use, long context, coding, vision — plus CORS and SSE streaming shape.

---

## Findings

### 1. Official OpenAI Chat Completions / Responses API

### [1.1] OpenAI Chat Completions is `POST https://api.openai.com/v1/chat/completions` with `Authorization: Bearer $OPENAI_API_KEY`.
- quote: "Creates a model response for the given chat conversation."
- url: https://platform.openai.com/docs/api-reference/chat/create
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [1.2] OpenAI recommends Responses API (`POST /v1/responses`) for new projects; Chat Completions remains the de-facto multi-vendor compatibility surface.
- quote: "Starting a new project? We recommend trying Responses to take advantage of the latest OpenAI platform features."
- url: https://platform.openai.com/docs/api-reference/chat/create
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [1.3] Model list endpoint is `GET https://api.openai.com/v1/models` (Bearer auth). Returns `{ object: "list", data: [{ id, created, object, owned_by, shutdown_date? }] }`.
- url: https://platform.openai.com/docs/api-reference/models
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [1.4] Chat Completions request body core fields (widely reused by all compatible providers): `model`, `messages[]` (roles `system`|`developer`|`user`|`assistant`|`tool`), `tools[]`, `tool_choice`, `temperature`, `top_p`, `max_tokens` / `max_completion_tokens`, `stream`, `stream_options.include_usage`, `response_format` (`text` | `json_object` | `json_schema`), `stop`, `seed`, `n`, `parallel_tool_calls`, `reasoning_effort`.
- url: https://platform.openai.com/docs/api-reference/chat/create
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [1.5] Non-stream response shape: `{ id, object: "chat.completion", created, model, choices: [{ index, message: { role: "assistant", content, tool_calls? }, finish_reason }], usage: { prompt_tokens, completion_tokens, total_tokens } }`. `finish_reason` ∈ `stop` | `length` | `tool_calls` | `content_filter` | `function_call`.
- url: https://platform.openai.com/docs/api-reference/chat/create
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [1.6] Example model IDs present in OpenAI API reference (2026-09): `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.1`, `gpt-5.1-codex`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`, `gpt-4o-mini`, `o3`, `o4-mini`. Cheap/fast defaults: `gpt-4o-mini` / `gpt-5.4-mini`. Vision-capable: `gpt-4o`, `gpt-4.1`, GPT-5 family.
- url: https://platform.openai.com/docs/api-reference/chat/create
- source_type: primary
- published: 2026-09
- confidence: high

### [1.7] Vision input uses multimodal `content` parts: `{ type: "image_url", image_url: { url: "data:image/png;base64,..." | "https://...", detail?: "auto"|"low"|"high" } }` plus `{ type: "text", text }`.
- url: https://platform.openai.com/docs/guides/images-vision
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [1.8] Tool use: request `tools: [{ type: "function", function: { name, description, parameters /* JSON Schema */ } }]`; assistant message returns `tool_calls: [{ id, type: "function", function: { name, arguments /* JSON string */ } }]`; client replies with `role: "tool", tool_call_id, content`.
- url: https://platform.openai.com/docs/api-reference/chat/create
- source_type: primary
- published: live as of 2026-09
- confidence: high

---

### 2. Provider matrix (baseURL, auth, free/cheap models)

### [2.1] OpenRouter — unified multi-provider proxy. Base URL `https://openrouter.ai/api/v1`. Auth: `Authorization: Bearer $OPENROUTER_API_KEY`. Optional app headers `HTTP-Referer`, `X-OpenRouter-Title`. Drop-in with OpenAI SDK (`baseURL` / `base_url` override).
- quote: "OpenRouter gives you access to hundreds of AI models through a single API endpoint."
- url: https://openrouter.ai/docs/quickstart
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.2] OpenRouter free models: append `:free` to a slug (e.g. `meta-llama/llama-3.3-70b-instruct:free`), or use Free Models Router `openrouter/free`. Free-tier limits: 50 req/day without credits; 1000 req/day if ≥$10 credits purchased. Not production-grade.
- quote: "The model is always provided for free and has low rate limits."
- url: https://openrouter.ai/docs/faq
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.3] OpenRouter model catalog + list endpoint: `GET https://openrouter.ai/api/v1/models`. Strong default for an AiFimora "bring any model" preset: one key for OpenAI, Anthropic, Google, xAI, DeepSeek, open-source, etc. Pricing is pass-through (no markup on inference).
- url: https://openrouter.ai/docs/faq
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.4] Groq — OpenAI-compatible. Base URL `https://api.groq.com/openai/v1`. Auth: `Authorization: Bearer $GROQ_API_KEY`. Chat: `POST /chat/completions`. Models: `GET /models`. Extremely low latency; strong free/cheap tier for an agent loop.
- url: https://console.groq.com/docs/api-reference
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.5] Groq notable model IDs (from API reference examples, 2026-09): `llama-3.3-70b-versatile` (general + tools), `llama-3.1-8b-instant` (cheap/fast, 128k ctx), `openai/gpt-oss-20b`, `openai/gpt-oss-120b` (open-weight, reasoning_effort support), `whisper-large-v3` / `whisper-large-v3-turbo` (STT), `playai-tts` (TTS). Vision models exist in Groq's catalog but chat examples above are text-first.
- url: https://console.groq.com/docs/api-reference
- source_type: primary
- published: 2026-09
- confidence: high

### [2.6] Together AI — OpenAI-compatible. Primary base `https://api.together.ai/v1`. Optimized inference host also documented: `https://api-inference.together.ai/v2`. Auth: `Authorization: Bearer $TOGETHER_API_KEY`. Chat: `POST /chat/completions`. Large open-model catalog (Llama, Qwen, DeepSeek, Mixtral, vision LLMs).
- url: https://docs.together.ai/reference/chat-completions
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.7] Together multimodal user content supports `text`, `image_url`, `video_url`, `audio_url`, `input_audio` — useful for a video editor agent that can attach clip stills / audio.
- url: https://docs.together.ai/reference/chat-completions
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.8] DeepSeek — OpenAI-compatible. Base URL `https://api.deepseek.com` (no extra `/v1` suffix in their OpenAI client examples; both `https://api.deepseek.com` and path `/chat/completions` work — official OpenAI Python example uses `base_url="https://api.deepseek.com"` and hits `/chat/completions`). Auth: `Authorization: Bearer $DEEPSEEK_API_KEY`. Also exposes Anthropic-compatible base `https://api.deepseek.com/anthropic`.
- quote: "The DeepSeek API uses an API format compatible with OpenAI/Anthropic."
- url: https://api-docs.deepseek.com/
- source_type: primary
- published: live as of 2026-09-14
- confidence: high

### [2.9] DeepSeek current model names (docs as of 2026-09-14): `deepseek-flash` (cheap/fast; legacy `deepseek-v4-flash` aliases retired and served by DeepSeek-V4.1-Flash), `deepseek-v4-pro` (continued after 2026-09-14). Supports thinking mode, vision, tool calls, JSON output, context caching.
- url: https://api-docs.deepseek.com/
- source_type: primary
- published: 2026-09-14
- confidence: high

### [2.10] Mistral — OpenAI-compatible chat. Base URL `https://api.mistral.ai/v1`. Auth: `Authorization: Bearer $MISTRAL_API_KEY`. Chat: `POST /v1/chat/completions`. Example model IDs: `mistral-large-latest`, `mistral-small-latest`. Supports tools, parallel_tool_calls, JSON schema response format, reasoning_effort, prompt_cache_key.
- url: https://docs.mistral.ai/api/endpoint/chat
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.11] xAI Grok — OpenAI-compatible. Base URL `https://api.x.ai/v1`. Auth: `Authorization: Bearer $XAI_API_KEY`. Docs emphasize Responses API (`POST /v1/responses`) with models like `grok-4.6` (agentic coding). Chat Completions remains available via the same OpenAI-compatible surface used by OpenAI SDKs (`base_url="https://api.x.ai/v1"`).
- url: https://docs.x.ai/docs/overview
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.12] Azure OpenAI (OpenAI-compatible, nonstandard paths). Endpoint host: `https://{resource-name}.openai.azure.com`. Classic data-plane path: `POST /openai/deployments/{deployment-id}/chat/completions?api-version=YYYY-MM-DD`. Auth: either header `api-key: <key>` OR `Authorization: Bearer <Entra token>`. Newer "v1" data-plane API is closer to OpenAI paths but still Azure-hosted. Clients must send `api-version` and use deployment name as `model`.
- quote: "POST https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2024-06-01"
- url: https://learn.microsoft.com/en-us/azure/foundry/openai/reference
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.13] Ollama local — OpenAI-compatible subset. Base URL `http://localhost:11434/v1`. Auth: any non-empty string (docs use `api_key='ollama'` — "required but ignored"). Endpoints: `/v1/chat/completions`, `/v1/completions`, `/v1/models`, `/v1/embeddings`, `/v1/responses` (non-stateful). Supports streaming, JSON mode, vision (base64 images), tools, reasoning_effort. Does not support `tool_choice`, `logit_bias`, `n`, remote image URLs.
- url: https://docs.ollama.com/api/openai
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.14] Ollama example models useful for a local editor agent: `gpt-oss:20b` (tools/reasoning), `qwen3:8b`, `qwen3-vl:8b` (vision). Model context size is set via Modelfile `PARAMETER num_ctx`, not the OpenAI request body.
- url: https://docs.ollama.com/api/openai
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.15] LM Studio — OpenAI-compatible. Default base URL `http://localhost:1234/v1`. Supported: `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, `/v1/models`, `/v1/responses`. Auth: optional bearer token (server can require one). Also has richer native REST (`/api/v1/...`) and Anthropic-compat. Headless daemon: `llmster` / `lms server start`.
- url: https://lmstudio.ai/docs/developer/openai-compat
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.16] vLLM — OpenAI-compatible HTTP server. Default `http://localhost:8000/v1`. Start: `vllm serve <hf-model> --api-key token-abc123`. Auth: `Authorization: Bearer <api-key>` when `--api-key` / `VLLM_API_KEY` is set. Endpoints: `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, `/v1/responses`, `/v1/audio/transcriptions`. Extra OpenAI-unsupported params via `extra_body` (`top_k`, `min_p`, `repetition_penalty`, `structured_outputs`, etc.).
- url: https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server.html
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [2.17] vLLM security note: `--api-key` only protects `/v1`, `/v2`, `/inference` prefixes — not `/invocations`. For a desktop app talking to a user-local vLLM this is low risk; do not assume LAN exposure is safe without a reverse proxy.
- url: https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server.html
- source_type: primary
- published: live as of 2026-09
- confidence: high

---

### 3. CORS / Electron desktop notes

### [3.1] Cloud OpenAI-compatible APIs (OpenAI, OpenRouter, Groq, DeepSeek, Mistral, Together, xAI) are designed for server-side or native clients. Browsers sending `Authorization` cross-origin from a `file://` or `http://localhost` renderer will typically fail CORS preflight. Electron should issue AI HTTP from the **main process** (or a utility process) via IPC, not from the sandboxed renderer `fetch`.
- url: https://www.electronjs.org/docs/latest/tutorial/context-isolation (general Electron security model; CORS constraint is industry-standard for these APIs)
- source_type: secondary (platform security guidance)
- published: live as of 2026-09
- confidence: high

### [3.2] Recommended AiFimora architecture: renderer → IPC (`ai:chat`) → main-process provider client (OpenAI SDK or raw fetch) → provider. Keep API keys in main (safeStorage / keytar), never in renderer. Streaming: main pipes SSE chunks back over IPC (`webContents.send` or MessagePort).
- url: https://www.electronjs.org/docs/latest/tutorial/ipc
- source_type: secondary (implementation recommendation)
- published: n/a
- confidence: high

### [3.3] Local providers (Ollama :11434, LM Studio :1234, vLLM :8000) are often called from browsers during dev; Ollama historically had CORS gaps from browser origins. Same rule: call from Electron main. For pure-browser debugging, set OLLAMA_ORIGINS / LM Studio CORS settings rather than `webSecurity: false`.
- url: https://docs.ollama.com/api/openai
- source_type: secondary
- published: live as of 2026-09
- confidence: medium

### [3.4] Do not use `webSecurity: false` or `webPreferences: { sandbox: false }` as a CORS workaround — it is a documented Electron anti-pattern and widens XSS impact in the editor UI.
- url: https://www.electronjs.org/docs/latest/tutorial/security
- source_type: primary
- published: live as of 2026-09
- confidence: high

---

### 4. Streaming (SSE) — chat completions

### [4.1] Enable with `"stream": true`. Response `Content-Type: text/event-stream`. Each event is `data: <json>\n\n`. Terminal sentinel is `data: [DONE]`. (Groq docs: "Tokens will be sent as data-only server-sent events… stream terminated by a `data: [DONE]` message." Same contract across OpenAI, OpenRouter, Together, Ollama, vLLM, LM Studio.)
- url: https://console.groq.com/docs/api-reference
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [4.2] Chunk object: `object: "chat.completion.chunk"`, `choices[0].delta` accumulates (`role` first, then `content` fragments, or `tool_calls` fragments). Final chunk has `finish_reason`. With `stream_options: { include_usage: true }`, a last chunk carries `usage` and empty `choices`.
- url: https://platform.openai.com/docs/api-reference/chat/create
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [4.3] Tool-call streaming: `delta.tool_calls[]` entries use `index` to correlate fragments; `function.arguments` is a JSON string that arrives incrementally and must be concatenated before `JSON.parse`.
- url: https://platform.openai.com/docs/guides/function-calling#streaming
- source_type: primary
- published: live as of 2026-09
- confidence: high

### [4.4] OpenAI Responses API streaming uses a different typed event stream (`response.created`, `response.output_text.delta`, `response.completed`, `error`) — do **not** assume chat-completions chunk shape if targeting Responses. Prefer Chat Completions for multi-provider compatibility in AiFimora v1.
- url: https://platform.openai.com/docs/guides/streaming-responses
- source_type: primary
- published: live as of 2026-09
- confidence: high

---

## Request / response reference (canonical)

### Chat Completions request (streaming + tools + optional vision)

```http
POST {baseURL}/chat/completions
Content-Type: application/json
Authorization: Bearer {apiKey}

{
  "model": "llama-3.3-70b-versatile",
  "messages": [
    { "role": "system", "content": "You are AiFimora's editing agent. Use tools to edit the timeline." },
    { "role": "user", "content": "Cut the first 3 seconds and add a fade." }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "timeline_trim",
        "description": "Trim a clip on the timeline",
        "parameters": {
          "type": "object",
          "properties": {
            "clipId": { "type": "string" },
            "startSec": { "type": "number" },
            "endSec": { "type": "number" }
          },
          "required": ["clipId", "startSec", "endSec"]
        }
      }
    }
  ],
  "tool_choice": "auto",
  "stream": true,
  "stream_options": { "include_usage": true },
  "temperature": 0.2,
  "max_tokens": 2048
}
```

Vision user content (for frame/thumbnail agents):

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "Describe this frame for tagging." },
    { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,/9j/...", "detail": "low" } }
  ]
}
```

### SSE response (text)

```
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1726000000,"model":"llama-3.3-70b-versatile","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1726000000,"model":"llama-3.3-70b-versatile","choices":[{"index":0,"delta":{"content":"Trim"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1726000000,"model":"llama-3.3-70b-versatile","choices":[{"index":0,"delta":{"content":" complete."},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1726000000,"model":"llama-3.3-70b-versatile","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1726000000,"model":"llama-3.3-70b-versatile","choices":[],"usage":{"prompt_tokens":42,"completion_tokens":18,"total_tokens":60}}

data: [DONE]
```

### SSE response (tool call fragments)

```
data: {"id":"chatcmpl-xyz","object":"chat.completion.chunk","created":1726000000,"model":"llama-3.3-70b-versatile","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"timeline_trim","arguments":""}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-xyz","object":"chat.completion.chunk","created":1726000000,"model":"llama-3.3-70b-versatile","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"clipId\":\"c1\""}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-xyz","object":"chat.completion.chunk","created":1726000000,"model":"llama-3.3-70b-versatile","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":",\"startSec\":0,\"endSec\":3}"}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-xyz","object":"chat.completion.chunk","created":1726000000,"model":"llama-3.3-70b-versatile","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}

data: [DONE]
```

Client then sends a follow-up request containing:

```json
{
  "role": "assistant",
  "tool_calls": [
    {
      "id": "call_1",
      "type": "function",
      "function": { "name": "timeline_trim", "arguments": "{\"clipId\":\"c1\",\"startSec\":0,\"endSec\":3}" }
    }
  ]
}
```

and

```json
{ "role": "tool", "tool_call_id": "call_1", "content": "{\"ok\":true}" }
```

### Minimal fetch parser (main process)

```ts
async function* streamChat(baseUrl: string, apiKey: string, body: unknown) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") return;
      yield JSON.parse(data);
    }
  }
}
```

---

## Recommended AiFimora default provider presets

Ship a preset picker in Settings → AI. All presets share one code path: `{ baseURL, apiKeyHeaderStyle: "bearer", model, supportsTools, supportsVision, supportsStreaming }`.

| Preset name | baseURL | Example model IDs | Auth | Best for |
|---|---|---|---|---|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4o` (vision), `gpt-5.4-mini` | Bearer | Default cloud quality + vision |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini`, `anthropic/claude-sonnet-4`, `google/gemini-2.5-flash`, `deepseek/deepseek-chat`, free: `meta-llama/llama-3.3-70b-instruct:free` or `openrouter/free` | Bearer + optional `HTTP-Referer` / `X-OpenRouter-Title` | "Any model" / BYOK aggregator |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-20b` | Bearer | Fast cheap agent tool-loop |
| **DeepSeek** | `https://api.deepseek.com` | `deepseek-flash`, `deepseek-v4-pro` | Bearer | Cheap strong reasoning + tools |
| **Together** | `https://api.together.ai/v1` | e.g. `meta-llama/Llama-3.3-70B-Instruct-Turbo`, Qwen vision models | Bearer | Open models + multimodal |
| **Mistral** | `https://api.mistral.ai/v1` | `mistral-small-latest`, `mistral-large-latest` | Bearer | EU / quality mid-tier |
| **xAI Grok** | `https://api.x.ai/v1` | `grok-4.6` | Bearer | Coding agent |
| **Azure OpenAI** | `https://{resource}.openai.azure.com` | deployment name (not catalog id); path `/openai/deployments/{id}/chat/completions?api-version=...` | `api-key` header or Entra Bearer | Enterprise |
| **Ollama** | `http://localhost:11434/v1` | `gpt-oss:20b`, `qwen3:8b`, `qwen3-vl:8b` | any string (`ollama`) | Offline / privacy |
| **LM Studio** | `http://localhost:1234/v1` | loaded local model id from `GET /v1/models` | optional Bearer | Offline GUI users |
| **vLLM** | `http://localhost:8000/v1` | served HF model id | Bearer if `--api-key` set | Power users / GPU workstations |

**Suggested shipped defaults for AiFimora v1:**

1. **Default cloud** — OpenAI `gpt-4o-mini` (or `gpt-5.4-mini` when generally available on the user's key) — vision + tools + long context, lowest friction.
2. **Value cloud** — DeepSeek `deepseek-flash` — very cheap agent loop.
3. **Aggregator** — OpenRouter — one key, free models for onboarding, fallback routing.
4. **Fast agent** — Groq `llama-3.3-70b-versatile` — snappy tool calls for timeline ops.
5. **Local / offline** — Ollama `http://localhost:11434/v1` with `gpt-oss:20b` or `qwen3-vl:8b` — privacy-preserving; no API key.

**UI capability flags to expose per preset/model:** `toolUse` (required for the editor agent), `vision` (frame tagging), `streaming` (always on), `contextWindow` (show in picker), `local` (no key required).

---

## Sources (primary)

- https://platform.openai.com/docs/api-reference/chat/create
- https://platform.openai.com/docs/api-reference/models
- https://platform.openai.com/docs/guides/streaming-responses
- https://platform.openai.com/docs/guides/function-calling
- https://openrouter.ai/docs/quickstart
- https://openrouter.ai/docs/faq
- https://console.groq.com/docs/api-reference
- https://docs.together.ai/reference/chat-completions
- https://api-docs.deepseek.com/
- https://docs.mistral.ai/api/endpoint/chat
- https://docs.x.ai/docs/overview
- https://learn.microsoft.com/en-us/azure/foundry/openai/reference
- https://docs.ollama.com/api/openai
- https://lmstudio.ai/docs/developer/openai-compat
- https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server.html
- https://www.electronjs.org/docs/latest/tutorial/security
