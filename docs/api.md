# API

A FastAPI app in [`main.py`](../server/src/forms_pilot/main.py) with three routers. Interactive docs are at `/docs`.

| Method and path | `operation_id` | Auth | Module |
| --- | --- | --- | --- |
| `GET /api/health` | `getHealth` | none | [`api/health.py`](../server/src/forms_pilot/api/health.py) |
| `POST /api/extract` | `extractFormValues` | bearer token, rate limit | [`api/extract.py`](../server/src/forms_pilot/api/extract.py) |
| `GET /sample-form` | not in the schema | none; `404` unless `DEV_MODE` | [`api/sample_form.py`](../server/src/forms_pilot/api/sample_form.py) |

## The extract request

```mermaid
sequenceDiagram
    autonumber
    participant SP as Side panel
    participant R as extract_form_values
    participant C as require_caller
    participant X as get_extractor
    participant D as prepare_sources
    participant M as Azure OpenAI
    participant K as check_values

    SP->>R: POST /api/extract { fields, images, documents }
    R->>C: dependency
    alt no tokens configured and not DEV_MODE
        C-->>SP: 503
    else token missing or wrong
        C-->>SP: 401
    else over the per-minute limit
        C-->>SP: 429 with Retry-After
    end
    R->>X: dependency
    alt Azure settings missing
        X-->>SP: 503
    end
    R->>R: validate ExtractRequest
    alt schema invalid
        R-->>SP: 422
    end
    R->>D: run_in_threadpool
    alt DocumentError
        D-->>SP: 422 with a readable message
    end
    D-->>R: sources
    R->>M: chat.completions.parse(ModelAnswer)
    alt model rate limit
        M-->>SP: 429
    else other OpenAI error
        M-->>SP: 502 (logged by error type only)
    end
    M-->>R: ModelAnswer
    R->>K: check_values(fields, answer.values)
    K-->>R: ExtractedValue per field
    R->>R: drop out-of-range image_index
    R-->>SP: 200 { values, sources }
```

Dependencies run before body validation errors are reported. A request with a valid token and an invalid body therefore gets `422`, but it still uses one of the caller's rate-limit slots.

Document parsing is CPU-bound, so it runs in the thread pool to keep the event loop free. After the checks, the route:

- clears `image_index` and adds an issue when the model pointed at a source that does not exist;
- rewords issues from "images" to "documents" when the request included documents.

## Auth and rate limiting

[`require_caller`](../server/src/forms_pilot/api/caller.py) returns the caller's name, which the route uses only for logs.

```mermaid
flowchart TD
    req(["request"]) --> tokens{"API_TOKENS set?"}
    tokens -->|no| dev{"DEV_MODE?"}
    dev -->|yes| local["caller = local"]
    dev -->|no| e503["503 No API tokens"]
    tokens -->|yes| bearer{"Authorization: Bearer?"}
    bearer -->|no| e401["401"]
    bearer -->|yes| cmp["hmac.compare_digest against<br/>every token (constant time)"]
    cmp -->|no match| e401
    cmp -->|match| named["caller = name"]
    local --> window
    named --> window["drop timestamps older than 60 s"]
    window --> full{"count ≥ RATE_LIMIT_PER_MINUTE?"}
    full -->|yes| e429["429 + Retry-After"]
    full -->|no| ok["record now, continue"]
```

- Tokens come from `API_TOKENS` as `name:token` pairs; each token must be at least 32 characters. Parsing errors name the entry by position, never by content.
- The rate limit is a sliding 60-second window per caller, kept in process memory. Every server process (or replica) keeps its own.
- With `DEV_MODE` on and no tokens, everyone is `local` and shares one limit. Once tokens are set, `DEV_MODE` no longer bypasses auth.

## Status codes

| Code | Raised by | Meaning |
| --- | --- | --- |
| `200` | route | Values and sources returned. Issues may still be present. |
| `401` | `require_caller` | Token missing or unknown. The panel offers **Set your API token**. |
| `422` | FastAPI / `prepare_sources` | Request schema invalid, or a document is invalid, damaged or over a limit. |
| `429` | `require_caller` / route | Caller over their limit, or Azure OpenAI rate-limited the model call. |
| `502` | route / extractor | The model call failed, or returned no parsed answer. |
| `503` | `require_caller` / `get_extractor` | No tokens and not in dev mode, or Azure OpenAI is not configured. |

## Schema

Defined in [`extraction/schema.py`](../server/src/forms_pilot/extraction/schema.py) and exported to the extension through OpenAPI.

```mermaid
classDiagram
    direction LR
    class ExtractRequest {
        fields: FormField[] 1..150
        images: ImageInput[] 0..8
        documents: DocumentInput[] 0..8
        images + documents: 1..8
    }
    class FormField {
        id: str
        label: str
        kind: FieldKind
        required: bool
        options: str[]
        hint: str?
    }
    class ImageInput {
        media_type: png, jpeg, webp, gif
        data: base64, max 7,000,000 chars
    }
    class DocumentInput {
        name: str
        media_type: pdf or xlsx
        data: base64, about 10 MB
    }
    class ExtractResponse {
        values: ExtractedValue[]
        sources: SourceInfo[]
    }
    class ExtractedValue {
        field_id: str
        value: str
        status: found, missing, ambiguous
        evidence: str?
        image_index: int?
        issues: str[]
    }
    class SourceInfo {
        name: str
        page: int?
        sheet: str?
    }
    class ModelAnswer {
        values: ModelValue[]
    }
    class ModelValue {
        field_id: str
        status: ValueStatus
        value: str
        evidence: str?
        image_index: int?
    }

    ExtractRequest *-- FormField
    ExtractRequest *-- ImageInput
    ExtractRequest *-- DocumentInput
    ExtractResponse *-- ExtractedValue
    ExtractResponse *-- SourceInfo
    ExtractedValue ..> SourceInfo : image_index points into sources
    ModelAnswer *-- ModelValue
    ModelValue ..> ExtractedValue : check_values
```

`ModelAnswer` and `ModelValue` are internal: they are the structured-output shape the model must return and are not part of the API. Every property is required there because structured output needs that; "nothing" is an empty string or `null`.

`image_index` keeps its name from the image-only version of the API. It now indexes `response.sources`, so older image-only clients keep working.
