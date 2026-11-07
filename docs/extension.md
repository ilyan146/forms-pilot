# Extension

A Manifest V3 extension built with [WXT](https://wxt.dev). Its manifest is generated from [`wxt.config.ts`](../extension/wxt.config.ts):

- **Permissions:** `sidePanel`, `activeTab`, `storage`.
- **Host permissions:** only the API origin from `WXT_API_URL` (default `http://localhost:8000`). Extension pages with a host permission call the API without CORS.
- **Content script matches:** every pattern in every [form profile](#form-profiles).

## Entrypoints

```mermaid
flowchart LR
    toolbar(["Toolbar button"]) --> bg["background.ts<br/>setPanelBehavior: open on click"]
    bg --> sp["sidepanel/index.html<br/>main.tsx"]
    sp -->|"scan, fill"| cs["content.ts<br/>injected on profile URLs"]
    cs --> scan["lib/form/scan.ts"]
    cs --> fill["lib/form/fill.ts"]
    cs --> profiles["lib/profiles.ts"]
```

| Entrypoint | Job |
| --- | --- |
| [`background.ts`](../extension/entrypoints/background.ts) | Makes the toolbar button open the side panel, so the panel stays next to the form. |
| [`content.ts`](../extension/entrypoints/content.ts) | Answers `scan` and `fill` messages on pages that match a profile. Highlights filled controls for 4 seconds. |
| [`sidepanel/`](../extension/entrypoints/sidepanel) | The React app: token settings, file drop, review and fill. |

## Message protocol

The side panel and content script share nothing but messages. [`lib/messages.ts`](../extension/lib/messages.ts) defines both sides with Zod, and every message and reply is validated on arrival.

```mermaid
sequenceDiagram
    autonumber
    participant SP as Side panel
    participant B as Browser tabs API
    participant CS as Content script
    participant DOM as Form page

    SP->>B: tabs.query active tab
    SP->>CS: sendMessage { type: "scan" }
    CS->>CS: contentRequestSchema.safeParse
    CS->>CS: profileFor(location.href)
    CS->>DOM: scanForm: read controls, stamp data-forms-pilot-field
    CS-->>SP: ScanReply { url, profile, fields }
    SP->>SP: scanReplySchema.parse

    Note over SP: user reads values via the API and reviews them

    SP->>CS: sendMessage { type: "fill", values }
    CS->>DOM: scanForm again (page may have re-rendered)
    CS->>DOM: fillForm: set values, fire input/change, highlight
    CS-->>SP: FillReply { outcomes[] }
    SP->>SP: fillReplySchema.parse
```

If no content script answers (the page has no profile, or it was open before the extension was installed), `sendMessage` rejects and the panel shows `NoFormError`: *"Forms Pilot does not support this page."*

## Side panel states

[`FormFlow.tsx`](../extension/entrypoints/sidepanel/FormFlow.tsx) holds the whole flow. The scan is a TanStack query (`["scan"]`); reading values and filling are mutations. Retries are off, so a failed scan reports immediately.

```mermaid
stateDiagram-v2
    [*] --> Scanning
    Scanning --> NoForm: scan rejected
    NoForm --> Scanning: Scan again
    Scanning --> Collecting: ScanReply

    Collecting --> Collecting: add or remove files
    Collecting --> Reading: Read values
    Reading --> Collecting: API error shown
    Reading --> Reviewing: values and sources

    Reviewing --> Reviewing: edit a value
    Reviewing --> Filling: Fill form (same URL only)
    Filling --> Reviewing: outcomes and summary
    Reviewing --> Collecting: Change files (keeps files)
    Reviewing --> Collecting: Start over (clears files)

    Collecting --> Scanning: tab activated or finished loading
    Reviewing --> Scanning: tab activated or finished loading
```

The rescan on tab change only updates the scanned form. An open review survives it, but **Fill form** is disabled while the active tab's URL differs from the URL the values were read for.

**Settings** is an overlay. [`App.tsx`](../extension/entrypoints/sidepanel/App.tsx) hides `FormFlow` instead of unmounting it, so files and edits survive a visit. A `401` from the API shows a **Set your API token** button that opens it.

## Preparing files

[`lib/images.ts`](../extension/lib/images.ts) turns dropped or picked files into request inputs. The picker accepts `image/*,.pdf,.xlsx`; at most 8 files per request.

```mermaid
flowchart TD
    file[/"File"/] --> size{"over 10 MB?"}
    size -->|yes| reject1["Error: exceeds the 10 MB file limit"]
    size -->|no| ext{"extension"}
    ext -->|".pdf"| pdf["DocumentInput<br/>application/pdf, base64"]
    ext -->|".xlsx"| xlsx["DocumentInput<br/>spreadsheetml, base64"]
    ext -->|other| img{"image/* type?"}
    img -->|no| reject2["Error: not supported"]
    img -->|yes| resize["Scale to at most 2000 px<br/>white background<br/>JPEG quality 0.85"]
    resize --> image["ImageInput<br/>image/jpeg, base64<br/>+ preview URL"]
    pdf --> split["extractionInputs"]
    xlsx --> split
    image --> split
    split --> body["request body:<br/>images[], documents[]"]
```

`extractionInputs` sends all images in `images` and all PDFs and workbooks in `documents`. The server numbers sources images first, so source order is not upload order (see [Extraction](extraction.md#how-sources-are-numbered)).

## Scanning

[`scanForm`](../extension/lib/form/scan.ts) walks every `input`, `textarea` and `select`:

```mermaid
flowchart TD
    start(["each control"]) --> fillable{"fillable?"}
    fillable -->|"disabled, read-only, hidden,<br/>button/file/password/submit…"| skip1["skip"]
    fillable -->|yes| id["field id:<br/>radio → name<br/>else id → name → field-N"]
    id --> ignored{"in profile.ignore?"}
    ignored -->|yes| skip2["skip, not stamped"]
    ignored -->|no| stamp["set data-forms-pilot-field = id"]
    stamp --> seen{"id already seen?<br/>(radio group)"}
    seen -->|yes| done1["stamped only"]
    seen -->|no| field["FormField"]
    field --> label["label: profile override →<br/>aria-labelledby → legend (radio) →<br/>aria-label → label → placeholder → name"]
    field --> kind["kind from element and type"]
    field --> req["required / aria-required<br/>(any radio in group)"]
    field --> opts["options: select options without<br/>empty value, or radio labels"]
    field --> hint["hint from profile"]
```

The `data-forms-pilot-field` stamp is how filling finds controls again without selectors.

## Filling

[`fillForm`](../extension/lib/form/fill.ts) receives only non-empty values ([`valuesToFill`](../extension/lib/review.ts)), so filling never clears what the user typed. Each value gets one outcome:

```mermaid
flowchart TD
    v(["field id, value"]) --> find{"stamped controls<br/>with this id?"}
    find -->|none| nf["not_found"]
    find -->|found| empty{"value empty?"}
    empty -->|yes| sk["skipped"]
    empty -->|no| type{"control type"}
    type -->|radio| r{"a radio's value or label<br/>matches?"}
    r -->|no| nm1["no_match"]
    r -->|yes| rc["click() it"] --> ok["filled"]
    type -->|checkbox| c{"yes/no word?"}
    c -->|no| nm2["no_match"]
    c -->|yes| cc["click() if state differs"] --> ok
    type -->|select| s{"option value or text<br/>matches?"}
    s -->|no| nm3["no_match"]
    s -->|yes| set1["setNativeValue"] --> ok
    type -->|"input, textarea"| set2["setNativeValue"] --> acc{"browser kept the value?"}
    acc -->|no| nm4["no_match"]
    acc -->|yes| ok
```

Matching ignores case but not accents. `setNativeValue` calls the prototype's `value` setter and dispatches `input` and `change`, which keeps React, Vue and Angular forms in sync; checkboxes and radios use `click()` for the same reason. [`fillSummary`](../extension/lib/review.ts) turns outcomes into the message under the button.

## Reviewing

[`lib/review.ts`](../extension/lib/review.ts) holds the rules [`ReviewList.tsx`](../extension/entrypoints/sidepanel/ReviewList.tsx) shows:

- The **draft** starts as the extracted values; edits change it.
- A field **needs attention** when the model said `ambiguous` or a check produced issues, unless the user already edited it.
- Evidence is shown as *Read "…" in invoice.pdf, page 2* or *in vehicles.xlsx, sheet Sheet1*, from `response.sources[image_index]`.

## Form profiles

[`lib/profiles.ts`](../extension/lib/profiles.ts) is the only place that knows about specific forms.

```mermaid
flowchart LR
    profile["FormProfile<br/>id, name, matches,<br/>fields, ignore"] -->|"PROFILE_MATCHES"| manifest["content script matches<br/>in the manifest"]
    profile -->|"profileFor(url)"| scan["scanForm: labels, hints,<br/>ignored fields"]
    scan --> api["hints reach the model<br/>in each FormField"]
```

Adding a form means adding a profile; the content script is not injected anywhere else. Field ids come from the page (`id`, or `name` for radio groups), so a profile never needs selectors. The current profile, `sample-customs`, matches the local [`/sample-form`](../server/src/forms_pilot/sample_form.html) and ignores `mra_aeo`.

## API client and token

[`configureApiClient`](../extension/lib/api.ts) runs once in `main.tsx`:

- `baseUrl` is `WXT_API_URL`, falling back to `http://localhost:8000`. The same value sets the host permission in `wxt.config.ts`; keep the two fallbacks in step.
- `auth` reads `apiToken` from extension storage for every request to an operation that declares bearer auth.
- An error interceptor turns any HTTP error into `ApiError`, using FastAPI's `detail` when it is a sentence. A `TypeError` from `fetch` means the server could not be reached.
