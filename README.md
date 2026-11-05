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

## Checks

```powershell
pnpm typecheck
pnpm test
pnpm lint:python
```
