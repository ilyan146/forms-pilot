# Forms Pilot

Forms Pilot fills a repetitive web form from images, PDFs and Excel workbooks. A Chrome/Edge side panel scans the form on the page, sends the fields and documents to a Python API, shows the values it found for review, and fills the form. It never submits the form.

## A small glossary

We need to be aligned about terms and words. When communicating, use this language:

- **you** means the agent reading and changing files.
- **we**, **us** and **maintainers** mean the contributors who build Forms Pilot.
- **users** means people who use the extension to fill forms in their daily work.
- **operator** means whoever deploys the API and hands out personal API tokens.
- **form profile** means an entry in `extension/lib/profiles.ts` that names the URLs a form lives on, plus field hints, labels and ignored fields.
- **source** means one thing the model reads: an image, a PDF page or a nonempty Excel sheet.

## Hit every surface

As a codebase grows, a common problem is that a change is implemented in one place but missed in others.

- An API shape change touches the server, the generated client (`pnpm gen:api`), the extension code that uses it, and the README section on `POST /api/extract` if documented behaviour changed.
- A new accepted file type or limit must be enforced in both places: the extension's upload checks (`extension/lib/images.ts`) and the server's bounds (`server/src/forms_pilot/extraction/`). Keep the limits in step and in the README.
- A change to the sample form (`server/src/forms_pilot/sample_form.html`) usually needs the form profile and the shared scan/fill tests updated with it.
- New behaviour that an operator should control goes through `server/src/forms_pilot/settings.py` and `.env.example`, not a hardcoded value.
- If you added a way in, add the way out and the way to see it. A one-way door is a bug.

## Development

- Make sure the repo root (or worktree) contains a `.env` copied from `.env.example`, with the Azure OpenAI settings and `DEV_MODE` on. Never print or commit its values.
- `pnpm dev:server` runs the API on port 8000; `pnpm dev:extension` regenerates the client and opens a fresh Chrome profile with the extension loaded at `/sample-form`. `/sample-form` only exists when `DEV_MODE` is on.
- The extension's API client in `extension/lib/client/` is generated and gitignored. Never edit it by hand; change the server and run `pnpm gen:api`.
- Prefer E2E verification on `/sample-form` using your harness's browser tools. Do not hunt for or install Playwright packages.
- Live extraction calls Azure OpenAI and costs money. Do not run it in loops; unit tests mock the model.
- Never commit customer documents (invoices, customs PDFs, workbooks) or anything derived from them as fixtures. Build synthetic fixtures in tests instead.
- Never stop a process by name or pattern match (`Stop-Process -Name`, `taskkill /IM`, `pkill -f`). Developers may run several dev servers at once. Stop only the PID you started.

## Verifying

- Smallest proof that the change works. Run only what covers your change:
  - Backend tests: `uv run --directory server pytest tests/<file>_test.py -q`
  - Backend types: `uv run --directory server basedpyright src/forms_pilot/<path>.py tests/<file>_test.py`
  - Backend lint: `pnpm lint:python`
  - Extension tests: `pnpm --filter @forms-pilot/extension exec vitest run lib/<path>.test.ts`
  - Extension types: `pnpm --filter @forms-pilot/extension typecheck` (run `pnpm gen:api` first if the API changed)
- Do not run repo-wide checks (`pnpm typecheck`, `pnpm test`, `pnpm build`) unless asked. CI runs them on every PR.
- Backend behaviour changes ship with focused tests for that behaviour. Test files are named `*_test.py` (backend) and `*.test.ts` (extension).
- Test meaningful logic or observable behaviour: scanning, filling, value checks, document parsing, request bounds. Do not render components to static markup to assert props, or add tests that mirror the implementation.
- Check whether the change makes the README inaccurate. Apply the [documentation rules](#documentation) before adding anything.

## Security

Users upload customs and invoice documents. Treat them as confidential.

- Model keys stay on the server. The extension never holds Azure credentials; it only holds the user's personal API token.
- Every extraction route depends on `require_caller` (`server/src/forms_pilot/api/caller.py`) for token auth and the per-caller rate limit. Do not add a route that reaches the model without it.
- `DEV_MODE` relaxes auth and serves the sample form. Nothing new may depend on it in production, and it must never be on by default.
- Uploaded files are processed in memory and never saved or logged. Keep parsing bounded (source count, cells, characters, bytes) and fail with a readable error before calling the model.
- Never execute workbook formulas or macros; read cached values only.
- The extension's host permissions stay limited to the configured API origin. Do not widen `permissions` or `host_permissions` in `extension/wxt.config.ts` without sign-off.
- The extension fills fields only. It must never submit a form, click a submit control, or fill fields a profile lists in `ignore`.

## Pull requests

- Never make a PR unless the developer explicitly asks you to do so.
- Conventional commit titles, plain language, with a scope: `feat(server): ...`, `feat(extension): ...`, `fix(extension): ...`.
- Body: the problem in a sentence or two, then how you fixed it, then what you verified and what you did not (for example live Azure extraction or a browser click-through). Do not add the model or harness that did the work.
- Stacked PRs: state the position and dependency in the body ("Stack 2/3, depends on #8") and the merge order.
- Give preference to visual evidence for extension or sample-form changes: screenshots of the side panel and the filled form, without customer data.
- When babysitting: poll checks and comments newer than the last push, verify each bot finding against the source, fix real ones, dismiss false positives with a written reason. Stop when CI is green on the latest commit and review threads are resolved.

## Documentation

The `README.md` is the only documentation. It covers running locally, form profiles, how values are read, and sharing with colleagues.

- Most code changes do not need a README change. Agents can read the code. Update the README when a change makes it inaccurate, or when a user or operator needs to do something differently (setup, limits, settings, file types, deployment).
- When behaviour changes, rewrite the affected text. Do not append another account of the new behaviour or a PR summary.
- Do not document every field, enumerate functions, narrate control flow, or keep file catalogs.
- Keep a local implementation explanation in a nearby code comment. Link to the source instead of copying it.

## How it works

The side panel scans the current page's fields, matched against a form profile, and posts them with the uploaded files to `POST /api/extract` through a TypeScript client generated from the server's OpenAPI spec. The FastAPI server renders PDF pages to images, parses `.xlsx` sheets directly, and asks an Azure OpenAI vision deployment for each field's value, status (`found`, `missing`, `ambiguous`) and evidence. Plain code then checks the values (dates, choices, numbers, IBANs) and turns failures into issues the user sees before filling. There is no confidence score, on purpose: the model's own confidence is not a reliable signal.

## Taste

- Give every API operation a clear, unique `operation_id` (for example `extractFormValues`) so generated client names stay readable.
- Complexity belongs at the boundaries: document parsing and model calls on the server, DOM scanning and filling in `extension/lib/form/`. React components stay dumb.
- The model reads; code validates. Prefer a deterministic check over another prompt instruction. Leave a field empty and flagged rather than guess.
- Inferred types over annotations. `any` is the enemy in TypeScript. In Python, an `Any` is fine where type safety would make the code noticeably more complex.
- Prefer functions over heavy classes.
- Folder structure needs to stay coherent. Find the correct folder for a new file. A folder with one file doesn't deserve to exist.
- Default to no comment. Write one only for a constraint, an external quirk, or an invariant the code can't show.
- If a rule here fights the task in front of you, say so loudly and get a human sign-off before breaking it.

## Where code lives

- `extension/`: WXT Manifest V3 extension (React, TypeScript, Tailwind, TanStack Query, Vitest).
  - `entrypoints/`: background worker, content script, and the `sidepanel/` UI.
  - `lib/form/`: page scanning and filling; `lib/profiles.ts`: form profiles; `lib/client/`: generated API client.
- `server/`: Python FastAPI API managed with uv (Ruff, Basedpyright, pytest).
  - `src/forms_pilot/api/`: routes and caller auth/rate limit.
  - `src/forms_pilot/extraction/`: document parsing, model call, response schema and value checks.
  - `src/forms_pilot/sample_form.html`: the local customs sample form.
- `patches/` and `pnpm-workspace.yaml`: a pinned patch so `@hey-api/openapi-ts` 0.99.0 works with TypeScript 7. Remove both together when the generator is upgraded.
