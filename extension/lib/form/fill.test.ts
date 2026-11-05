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
    scanForm(document);
  });

  it("fills text, dates, selects, radios and checkboxes", () => {
    const outcomes = fillForm(document, {
      supplier_name: "Acme Dredging B.V.",
      invoice_date: "2026-10-28",
      currency: "euro",
      payment_terms: "30 days",
      urgent: "yes",
      notes: "Phase 1",
    });

    expect(outcomes.every((outcome) => outcome.status === "filled")).toBe(true);
    expect(input("supplier_name").value).toBe("Acme Dredging B.V.");
    expect(input("invoice_date").value).toBe("2026-10-28");
    expect((document.getElementById("currency") as HTMLSelectElement).value).toBe("EUR");
    expect(document.querySelector<HTMLInputElement>("input[value='30']")?.checked).toBe(true);
    expect(input("urgent").checked).toBe(true);
  });

  it("reports values the form cannot take instead of guessing", () => {
    const outcomes = fillForm(document, {
      invoice_date: "28/10/2026",
      currency: "Bitcoin",
      urgent: "maybe",
      missing_field: "x",
    });

    expect(outcomes).toEqual([
      { id: "invoice_date", status: "no_match" },
      { id: "currency", status: "no_match" },
      { id: "urgent", status: "no_match" },
      { id: "missing_field", status: "not_found" },
    ]);
  });

  it("never clears what the user typed when a value is empty", () => {
    input("iban").value = "typed by hand";

    expect(fillForm(document, { iban: "  " })).toEqual([{ id: "iban", status: "skipped" }]);
    expect(input("iban").value).toBe("typed by hand");
  });

  it("bypasses a framework's value tracker so its change handler sees the update", () => {
    // React wraps the instance's value property to remember the last value it saw.
    const element = input("supplier_name");
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

    fillForm(document, { supplier_name: "Acme" });

    expect(seenOnInput).toBe("Acme");
    expect(tracked).toBe("");
  });
});
