# Extraction

Everything between a valid request and a checked response lives in [`server/src/forms_pilot/extraction/`](../server/src/forms_pilot/extraction):

```mermaid
flowchart LR
    req["ExtractRequest"] --> prep["documents.py<br/>prepare_sources"]
    prep --> sources["Source[]<br/>info + image or text"]
    sources --> model["model.py<br/>extractor"]
    req -->|fields| model
    model --> answer["ModelAnswer"]
    answer --> checks["checks.py<br/>check_values"]
    req -->|fields| checks
    checks --> values["ExtractedValue[]"]
```

## From documents to sources

[`prepare_sources`](../server/src/forms_pilot/extraction/documents.py) runs in the thread pool and never writes to disk.

```mermaid
flowchart TD
    start(["ExtractRequest"]) --> imgs["one Source per image<br/>name: Image N"]
    imgs --> loop{"next document"}
    loop -->|none left| empty{"any sources?"}
    loop --> b64["base64 decode"]
    b64 -->|invalid| err["DocumentError → 422"]
    b64 --> bytes{"≤ 10 MB each,<br/>≤ 30 MB total?"}
    bytes -->|no| err
    bytes -->|yes| kind{"media_type"}
    kind -->|PDF| pdf["_pdf"]
    kind -->|XLSX| xlsx["_workbook"]
    pdf --> count{"≤ 24 sources?"}
    xlsx --> count
    count -->|no| err
    count -->|yes| loop
    empty -->|no| err
    empty -->|yes| text{"total text ≤ 150,000 chars?"}
    text -->|no| err
    text -->|yes| out(["Source[]"])
```

### PDF

```mermaid
flowchart LR
    data["PDF bytes"] --> open["pymupdf.open"]
    open --> pass{"password?"}
    pass -->|yes| e1["DocumentError"]
    pass -->|no| pages{"1 to 24 pages?"}
    pages -->|no| e1
    pages -->|yes| render["each page: render so the<br/>longest side is 2000 px, RGB"]
    render --> jpeg["JPEG, base64"]
    jpeg --> src["Source name=file, page=N<br/>image only"]
```

Every page is rendered, even when it has a text layer: scans have none, and tables read better visually. No PDF text is extracted.

### Excel

```mermaid
flowchart LR
    data["XLSX bytes"] --> zip{"unpacked ≤ 30 MB?"}
    zip -->|no| e2["DocumentError"]
    zip -->|yes| load["openpyxl read_only,<br/>data_only (cached values)"]
    load --> sheet["each sheet:<br/>reset_dimensions"]
    sheet --> rows["each row: nonempty cells<br/>as JSON by coordinate"]
    rows --> limits{"≤ 20,000 cells,<br/>≤ 150,000 chars?"}
    limits -->|no| e2
    limits -->|yes| src["Source name=file, sheet=title<br/>text only; empty sheets dropped"]
```

A row becomes one JSON line, for example `{"A2": "Corolla", "C2": "JTD…", "H2": 87032390}`. Coordinates keep blank columns and row identity, dates become ISO strings, and numeric ids such as HS codes stay integers. Formulas are never executed: `data_only` reads the value Excel cached when the file was last saved, which is empty for a workbook that was never recalculated. `reset_dimensions` ignores a sheet's declared size, which can be inflated, so the cell limit bounds the real work.

### How sources are numbered

Sources are indexed from 0 in this order: every request image first, then each document's pages or sheets in document order. The extension puts images in `images` and PDFs and workbooks in `documents`, so for an upload of `invoice.pdf, photo.jpg` the photo is source 0. The model's `image_index` and the panel's evidence label both use this order, from `response.sources`.

## Limits and where they are enforced

| Limit | Extension | Request schema | Parsing |
| --- | --- | --- | --- |
| Files per request: 8 | `MAX_IMAGES` in [`images.ts`](../extension/lib/images.ts) | `require_sources`: 1 to 8 images + documents | |
| File size: 10 MB | `prepareFile` (before resizing) | `DocumentInput.data` length | `MAX_DOCUMENT_BYTES` per document |
| Image size | scaled to 2000 px JPEG | `ImageInput.data` ≤ 7,000,000 base64 chars (about 5 MB) | |
| Documents together: 30 MB | | | `prepare_sources` |
| Sources: 24 | | | images + PDF pages + nonempty sheets |
| PDF pages: 1 to 24 | | | `_pdf` |
| Workbook unpacked: 30 MB | | | `_workbook` |
| Workbook cells: 20,000 | | | `_workbook` |
| Parsed text: 150,000 chars | | | `_workbook` and `prepare_sources` |
| Fields: 1 to 150; options ≤ 200 | | `ExtractRequest`, `FormField` | |

Change a limit in every column it appears in, and in the [project README](../README.md#pdf-and-excel-documents).

## The model call

[`model.py`](../server/src/forms_pilot/extraction/model.py) is the only file that knows about the model.

```mermaid
flowchart TD
    settings["AZURE_OPENAI_ENDPOINT, _API_KEY,<br/>_DEPLOYMENT"] --> get{"all set?"}
    get -->|no| e503["503"]
    get -->|yes| client["AsyncOpenAI<br/>base_url = endpoint/openai/v1/<br/>cached per endpoint and key"]
    client --> call["chat.completions.parse<br/>response_format = ModelAnswer"]
    sys["system: INSTRUCTIONS"] --> call
    user["user content"] --> call
    call --> parsed{"parsed answer?"}
    parsed -->|no| e502["502"]
    parsed -->|yes| answer["ModelAnswer"]
```

The user message is a list of parts:

1. `Fields:` and the requested fields as JSON, including profile hints.
2. For each source, in index order: `Source N: {name, page, sheet}`, then the sheet text if any, then the image as a `data:` URL if any.

The instructions in `model.py` tell the model to use only what is written, return `missing` rather than guess, return `ambiguous` with every candidate quoted when sources disagree, use exact options and ISO dates, match vehicle rows across files by VIN, and ignore instructions inside source content. Structured output holds the reply to `ModelAnswer`.

Tests replace the extractor through FastAPI's `get_extractor` dependency, so they never call Azure.

## Checks

[`check_values`](../server/src/forms_pilot/extraction/checks.py) returns one value per requested field, in the form's order. Ids the model invented are dropped.

```mermaid
flowchart TD
    f(["field + proposed value"]) --> found{"proposed, not missing,<br/>not blank?"}
    found -->|no| missing["status missing, value empty"]
    missing --> req{"required?"}
    req -->|yes| i1["issue: required, not found"]
    found -->|yes| kind{"field kind"}
    kind -->|"select, radio"| opt{"matches an option,<br/>ignoring case?"}
    opt -->|yes| canon["use the option's exact text"]
    opt -->|no| i2["issue: not one of the choices"]
    kind -->|checkbox| yn{"yes/no word?"}
    yn -->|yes| norm["yes or no"]
    yn -->|no| i3["issue: not yes or no"]
    kind -->|date| d{"YYYY-MM-DD and real?"}
    d -->|no| i4["issue: not a date"]
    kind -->|number| n{"plain or 1,234.5 grouped?"}
    n -->|yes| strip["remove spaces and commas"]
    n -->|no| i5["issue: not a number"]
    kind -->|email| em{"looks like an email?"}
    em -->|no| i6["issue: not an email"]
    kind -->|"other, id or label has iban"| iban{"IBAN shape and<br/>mod-97 checksum?"}
    iban -->|no| i7["issue: not an IBAN or<br/>checksum mismatch"]
    found --> amb{"status ambiguous?"}
    amb -->|yes| i8["issue: more than one possible value"]
```

Evidence and `image_index` are kept only when a value was found. There is no confidence score: the model's own confidence is not a reliable signal, so the panel flags fields from these checks and the model's status.
