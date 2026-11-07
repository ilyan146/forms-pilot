# API client generation

The extension's API client is generated from the FastAPI app, so the server's Pydantic models are the only declaration of the API.

```mermaid
flowchart LR
    subgraph server["server/"]
        models["Pydantic models<br/>extraction/schema.py"]
        routes["routes with operation_id"]
        export["python -m forms_pilot.export_openapi"]
        spec[("openapi.json")]
    end
    subgraph extension["extension/"]
        cfg["openapi-ts.config.ts"]
        gen["@hey-api/openapi-ts 0.99.0"]
        subgraph client["lib/client/"]
            types["types.gen.ts<br/>ExtractRequest, ExtractedValue…"]
            sdk["sdk.gen.ts<br/>extractFormValues, getHealth"]
            rq["@tanstack/react-query.gen.ts<br/>extractFormValuesMutation"]
            fetch["client.gen.ts<br/>fetch client"]
        end
    end

    models --> routes --> export --> spec
    spec --> gen
    cfg --> gen
    gen --> types
    gen --> sdk
    gen --> rq
    gen --> fetch
    fetch --> api["lib/api.ts<br/>configureApiClient"]
    rq --> flow["FormFlow.tsx"]
    types --> libs["images.ts, review.ts,<br/>ReviewList.tsx"]
```

`pnpm gen:api` at the repo root runs both steps. `pnpm dev:extension`, `pnpm build`, `pnpm zip` and `pnpm typecheck` run it first, so the client is always rebuilt from the current server. Both `server/openapi.json` and `extension/lib/client/` are gitignored; never edit them by hand.

## What drives the generated names

- Each route's `operation_id` becomes the SDK function and the TanStack helper names: `extractFormValues` → `extractFormValuesMutation`. Give every new route a clear, unique one.
- Pydantic model names become TypeScript type names.
- `require_caller` uses FastAPI's `HTTPBearer`, so the spec marks `extractFormValues` as needing bearer auth. The generated client calls the `auth` callback from `configureApiClient` only for those operations.

## Changing the API

```mermaid
flowchart LR
    a["change schema.py or a route"] --> b["pnpm gen:api"]
    b --> c["fix TypeScript errors<br/>in the extension"]
    c --> d["targeted tests on both sides"]
    d --> e["update README if documented<br/>behaviour changed"]
```

## The TypeScript 7 patch

`@hey-api/openapi-ts` 0.99.0 prints code with the legacy TypeScript compiler API, which TypeScript 7 no longer ships. Two pieces work around it:

- [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) adds `typescript-legacy` (an alias of `typescript@6.0.3`) as a dependency of the generator.
- [`patches/@hey-api__openapi-ts@0.99.0.patch`](../patches/@hey-api__openapi-ts@0.99.0.patch) points the generator at that alias.

Remove both together when upgrading to a generator that no longer needs the old API.
