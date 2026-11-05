# forms-pilot

Forms Pilot fills a repetitive web form from images. Open the side panel next to the form, drop in photos or scans, review the values it found, then fill the form. It never submits the form for you.

It has two parts:

- `extension/`: a Chrome and Edge extension (Manifest V3) built with [WXT](https://wxt.dev), React and TypeScript. It reads the form on the page, shows the side panel and fills fields.
- `server/`: a Python FastAPI API. It sends images to a vision model and checks the values before returning them. Model keys stay on the server.

## Requirements

- Node 22+ and pnpm
- Python 3.12+ and [uv](https://docs.astral.sh/uv/)

## Run locally

```powershell
pnpm install
uv sync --directory server

# Terminal 1: API on http://localhost:8000 (docs at /docs)
pnpm dev:server

# Terminal 2: extension with hot reload in a separate Chrome profile
pnpm dev:extension
```

To load a production build by hand, run `pnpm build`, open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked** and select `extension/.output/chrome-mv3`.

### Try it on the sample form

With the API running, open <http://localhost:8000/sample-form>, open the Forms Pilot side panel from the toolbar and choose **Scan this page**.

## Form profiles

The extension only runs on pages listed in a form profile, in `extension/lib/profiles.ts`. A profile names the URLs the form lives on and, per field id, can add a hint for the model, a clearer label or an example value. Fields themselves are found by scanning the page, so a profile does not need selectors.

To add a form:

1. Add a profile with the form's URL in `matches` (a [Chrome match pattern](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)).
2. Load the extension, open the form and choose **Scan this page**. The ids it lists are the keys to use in `fields`.
3. Add hints for fields that need them, and list fields that must never be filled, such as a captcha or a consent box, in `ignore`.

The extension never submits a form. Filling only changes field values.

## Checks

```powershell
pnpm typecheck
pnpm test
pnpm lint:python
```
