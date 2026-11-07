import { beforeEach, describe, expect, it } from "vitest";

import { fillForm } from "@/lib/form/fill";
import { loadSampleForm } from "@/lib/form/fixture";
import { scanForm } from "@/lib/form/scan";

function input(id: string) {
  return document.getElementById(id) as HTMLInputElement;
}

describe("fillForm", () => {
  beforeEach(() => {
    loadSampleForm();
    // Keep generic control coverage beyond the customs sample's text/select fields.
    document.getElementById("customs-declaration")!.insertAdjacentHTML("beforeend", `
      <input id="test_date" type="date" aria-label="Test date">
      <fieldset><legend>Test terms</legend>
        <label><input type="radio" name="test_terms" value="14">14 days</label>
        <label><input type="radio" name="test_terms" value="30">30 days</label>
      </fieldset><textarea id="test_notes" aria-label="Test notes"></textarea>`);
    scanForm(document);
  });

  it("fills text, dates, selects, radios and checkboxes", () => {
    const outcomes = fillForm(document, {
      exporter_code: "AE-TEST-001",
      test_date: "2026-10-28",
      cargo_channel: "sea",
      test_terms: "30 days",
      mra_aeo: "yes",
      test_notes: "Phase 1",
    });

    expect(outcomes.every((outcome) => outcome.status === "filled")).toBe(true);
    expect(input("exporter_code").value).toBe("AE-TEST-001");
    expect(input("test_date").value).toBe("2026-10-28");
    expect((document.getElementById("cargo_channel") as HTMLSelectElement).value).toBe("sea");
    expect(document.querySelector<HTMLInputElement>("input[value='30']")?.checked).toBe(true);
    expect(input("mra_aeo").checked).toBe(true);
  });

  it("reports values the form cannot take instead of guessing", () => {
    const outcomes = fillForm(document, {
      test_date: "28/10/2026",
      cargo_channel: "Rail",
      mra_aeo: "maybe",
      missing_field: "x",
    });

    expect(outcomes).toEqual([
      { id: "test_date", status: "no_match" },
      { id: "cargo_channel", status: "no_match" },
      { id: "mra_aeo", status: "no_match" },
      { id: "missing_field", status: "not_found" },
    ]);
  });

  it("never clears what the user typed when a value is empty", () => {
    input("client_reference").value = "typed by hand";

    expect(fillForm(document, { client_reference: "  " })).toEqual([{ id: "client_reference", status: "skipped" }]);
    expect(input("client_reference").value).toBe("typed by hand");
  });

  it("bypasses a framework's value tracker so its change handler sees the update", () => {
    // React wraps the instance's value property to remember the last value it saw.
    const element = input("exporter_code");
    const prototypeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
    let tracked = "";
    Object.defineProperty(element, "value", {
      configurable: true,
      get: () => prototypeValue.get!.call(element),
      set: (next: string) => {
        tracked = next;
        prototypeValue.set!.call(element, next);
      },
    });
    let seenOnInput = "";
    element.addEventListener("input", () => {
      seenOnInput = element.value;
    });

    fillForm(document, { exporter_code: "Acme" });

    expect(seenOnInput).toBe("Acme");
    expect(tracked).toBe("");
  });
});
