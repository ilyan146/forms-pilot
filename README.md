# forms-pilot

Forms Pilot fills a repetitive web form from images. Open the side panel next to the form, drop in photos or scans, review the values it found, then fill the form. It never submits the form for you.

It has two parts:

- `extension/`: a Chrome and Edge extension (Manifest V3) built with [WXT](https://wxt.dev), React and TypeScript. It reads the form on the page, shows the side panel and fills fields.
- `server/`: a Python FastAPI API. It sends images to a vision model and checks the values before returning them. Model keys stay on the server.

## Requirements

- Node 22+ and pnpm
- Python 3.12+ and [uv](https://docs.astral.sh/uv/)

## Run locally

Copy `.env.example` to `.env` and fill in an Azure OpenAI endpoint, key and a vision-capable chat deployment. Without them the API still starts, and `/api/extract` answers 503. The example turns on `DEV_MODE`, which serves the sample form and lets the extension call the API without a token.

```powershell
pnpm install
uv sync --directory server

# Terminal 1: API on http://localhost:8000 (docs at /docs)
pnpm dev:server

# Terminal 2: extension with hot reload in a separate Chrome profile
pnpm dev:extension
```

The extension calls the API at `http://localhost:8000`. To use another server, set `WXT_API_URL` in `extension/.env` before building; the extension is only allowed to reach that origin.

The extension's API client is generated from the server's OpenAPI spec. `pnpm dev:extension`, `pnpm build` and `pnpm typecheck` regenerate it first; after changing an API shape on its own, run `pnpm gen:api`. The generated files are not committed.

To load a production build by hand, run `pnpm build`, open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked** and select `extension/.output/chrome-mv3`.

### Try it on the sample form

With the API running, open <http://localhost:8000/sample-form> and open the Forms Pilot side panel from the toolbar. Drop a photo or screenshot of an invoice, choose **Read values**, check the flagged fields and choose **Fill form**. The extension never submits the form; you do that yourself.

## Form profiles

The extension only runs on pages listed in a form profile, in `extension/lib/profiles.ts`. A profile names the URLs the form lives on and, per field id, can add a hint for the model or a clearer label. Fields themselves are found by scanning the page, so a profile does not need selectors.

To add a form:

1. Add a profile with the form's URL in `matches` (a [Chrome match pattern](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)).
2. Load the extension, open the form and open the side panel, which scans the page. Inspect a field in the browser's developer tools: its `data-forms-pilot-field` attribute is the id to use in `fields`.
3. Add hints for fields that need them, and list fields that must never be filled, such as a captcha or a consent box, in `ignore`.

The extension never submits a form. Filling only changes field values.

## How values are read

`POST /api/extract` takes the scanned fields and the images. A vision model returns, for each field, a value, a status (`found`, `missing` or `ambiguous`), the text it read and which image it came from. The model is told to leave a field empty rather than guess.

The server then checks every value with plain code: dates must exist and be `YYYY-MM-DD`, choices must be one the form offers, numbers must parse, and IBANs must pass their checksum. Anything that fails becomes an issue the user sees before filling.

There is no confidence score. A model's own confidence is not a reliable measure of whether a value is right, so the side panel flags fields based on these checks and the model's status instead.

## Share it with colleagues

### Run the API

Build the image from `server/` and run it anywhere that gives it HTTPS, such as Azure Container Apps:

```powershell
docker build -t forms-pilot-api server
docker run -p 8000:8000 --env-file .env forms-pilot-api
```

On a deployed server, leave `DEV_MODE` unset and give every person their own token in `API_TOKENS` (`name:token`, comma-separated, at least 32 characters each). Without tokens the API refuses every extraction. To take someone's access away, remove their entry and restart. Each person can make `RATE_LIMIT_PER_MINUTE` extractions a minute (10 by default). The limit is kept in memory, so it applies per server process.

The API does not need CORS settings: the extension's side panel calls it with a host permission, which browsers exempt from CORS, and web pages are not meant to call it.

### Install the extension

Set `WXT_API_URL` in `extension/.env` to the API's URL, then run `pnpm zip`. Share the zip from `extension/.output`. Each colleague unzips it, opens `chrome://extensions` or `edge://extensions`, turns on Developer mode and chooses **Load unpacked**. For updates without manual steps, publish it as an unlisted item on the Chrome Web Store or Edge Add-ons.

The first time, open the side panel, choose **Settings** and paste the personal token.

## Checks

```powershell
pnpm typecheck
pnpm test
pnpm lint:python
```
