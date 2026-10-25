# Pharmodry — AI Architecture

**Guiding rule:** AI explains, summarises and drafts. It never decides. No AI code path can release, reject, approve, close, classify or modify a regulated record. Every GMP decision stays with an authorised person and their electronic signature.

## Components

| Component | Location | Role |
|---|---|---|
| `LLMProvider` interface | `apps/api/src/infrastructure/llm/llm.provider.ts` | `chat(messages, {temperature, maxTokens, json})`. Lets Mistral be swapped for another model without touching callers. |
| `MistralProvider` | same file | Calls `${MISTRAL_BASE_URL}/chat/completions` with `fetch` from the API server. The key is read from `MISTRAL_API_KEY` and never sent to the browser. |
| `LlmRegistry` | same file | Returns the configured provider, or `null` when no key is set. |
| Copilot tools | `apps/api/src/modules/ai/copilot.tools.ts` | Deterministic intent rules plus read-only retrieval tools that compute facts and citations from the database. |
| `AiService` | `apps/api/src/modules/ai/ai.service.ts` | Orchestrates copilot Q&A, deviation investigation assistance and CAPA drafting. Handles logging and fallbacks. |
| Web | `/copilot`, the deviation page "AI assist" panel, the CAPA form "Draft with AI" | Answers are marked with an *AI-generated — review before use* label and show citations as links to the source records. |

## Copilot request flow

```
POST /api/v1/ai/copilot/ask  (requires ai.copilot.use; tenant AI setting must be enabled)
 1. Intent: regex rules (detectIntent) → if none match and a provider exists, the LLM picks ONE intent
    from a fixed enum (JSON mode, temperature 0); anything else → OPERATIONS_SUMMARY
 2. Permission gate: each intent maps to a domain permission (e.g. OVERDUE_CAPAS → capa.view).
    Without it the user gets a refusal — no data is retrieved
 3. Retrieval tool runs through the tenant-scoped Prisma client → facts, rows, citations (record links)
 4. No provider → deterministic answer built from the computed facts
    ("AI provider not configured … Showing computed facts only")
 5. Provider → system prompt + sanitised JSON inside <data>…</data> → answer.
    Provider error → the same deterministic fallback
 6. Persist AiConversation / AiMessage (question, intent, answer, citations, facts, model, tokens, latency)
```

Intents in this release: plan achievement, delayed batches, batches awaiting release, overdue CAPAs, OOS status, quality trends, deviations, stock-out risk, near-expiry / slow-moving stock, supplier quality, operations summary.

## Assistants

- **Deviation investigation assist** (`POST /ai/deviations/:id/assist`, `ai.assist.use` + site scope). Pharmodry itself finds similar historical deviations with PostgreSQL trigram similarity on the title, plus matching category, equipment and product. It attaches their approved root causes and CAPAs. With a provider, the model also suggests investigation areas, questions and possible fishbone factors (6M categories). It is told not to state a root cause as established. Without a provider, only the computed similar cases are returned.
- **CAPA draft** (`POST /ai/capa/draft`). Produces draft corrective actions, preventive actions and effectiveness checks from the deviation/OOS problem statement and the approved root cause. The user must review, edit and save the drafts through the normal CAPA workflow, which records them under the user's identity. Without a provider it returns `503 AI_UNAVAILABLE` and the user drafts manually.

## Safety controls

| Risk | Control |
|---|---|
| Unauthorised data exposure | Intent → permission gate. Tools use the tenant-scoped client. Assistants check site scope. |
| Prompt injection through stored text (e.g. a deviation description saying "ignore previous instructions") | `sanitizeForPrompt`: strips control characters, replaces instruction-like phrases, neutralises `system:` / `assistant:` role markers, removes e-mail addresses, truncates strings (400 characters) and arrays (30 items). Data is delimited in `<data>` and the system prompt says to treat it as data only. Unit tests cover the sanitiser. |
| Hallucinated numbers | All numbers are computed by Pharmodry. The prompt forbids new calculations and invented records. Citations link to the source records. The deterministic fallback shows the same facts. |
| AI making GMP decisions | AI code only reads domain tables (plus read-only analytics/supplier scorecard services). Its only writes are its own conversation, message and feedback tables and audit events. Outputs are suggestions displayed in the UI. Regulated changes still go through workflows with permissions and e-signatures. |
| Cost / abuse | Question length capped at 1000 characters, `maxTokens` capped per call, global API rate limits. The `/ai/usage` endpoint (`ai.admin`) reports usage. |
| Data retention | Tenant setting `ai.retentionDays` (default 180). The scheduled compliance scan redacts the stored question/answer text and facts of older AI messages (`redactedAt` set; metadata kept). `ai.enabled`, `ai.storePrompts` and `ai.retentionDays` are tenant settings in **Admin → Organisation**; usage and feedback are in **Admin → AI governance**. |
| Feedback | Thumbs up/down with an optional comment (`AiFeedback`) for quality monitoring. |

## Configuration

```bash
MISTRAL_API_KEY=…                 # server-side only; empty = AI disabled, fallbacks active
MISTRAL_MODEL=mistral-small-latest
MISTRAL_BASE_URL=https://api.mistral.ai/v1
```

## Verification status

- Tested: intent detection and the sanitiser (unit tests); the copilot permission, the domain-permission gate, the deterministic copilot fallback and the CAPA-draft 503 path (API e2e, `exceptions.e2e-spec.ts`). In the test environment no key is configured, so the e2e logs show `AI provider not configured` for the CAPA draft.
- **Not tested: live calls to the Mistral API.** No API key was available in the build environment. Before relying on the AI features, run the copilot and assistants with a real key in a non-production tenant and review answer quality and latency.
- Document Copilot (retrieval over SOPs/specifications with embeddings) is not implemented. It is on the roadmap.
