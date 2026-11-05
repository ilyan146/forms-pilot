import { beforeEach, describe, expect, it } from "vitest";

import { loadSampleForm } from "@/lib/form/fixture";
import { scanForm } from "@/lib/form/scan";
import { profileFor } from "@/lib/profiles";

describe("scanForm", () => {
  beforeEach(() => {
    loadSampleForm();
  });

  it("finds every fillable field once, with the label a person sees", () => {
    const fields = scanForm(document);

    expect(fields.map((field) => [field.id, field.label])).toEqual([
      ["supplier_name", "Supplier name"],
      ["invoice_number", "Invoice number"],
      ["po_reference", "PO reference"],
      ["invoice_date", "Invoice date"],
      ["due_date", "Due date"],
      ["currency", "Currency"],
      ["total_amount", "Total amount (incl. VAT)"],
      ["vat_number", "Supplier VAT number"],
      ["iban", "IBAN"],
      ["payment_terms", "Payment terms"],
      ["urgent", "Urgent payment"],
      ["notes", "Notes"],
    ]);
  });

  it("describes kinds, required fields and choices", () => {
    const byId = new Map(scanForm(document).map((field) => [field.id, field]));

    expect(byId.get("invoice_date")).toMatchObject({ kind: "date", required: true });
    expect(byId.get("due_date")).toMatchObject({ kind: "date", required: false });
    expect(byId.get("currency")?.options).toEqual(["Euro", "US dollar", "UAE dirham"]);
    expect(byId.get("payment_terms")).toMatchObject({
      kind: "radio",
      options: ["14 days", "30 days", "60 days"],
    });
    expect(byId.get("urgent")?.kind).toBe("checkbox");
  });

  it("adds profile hints and leaves out ignored fields", () => {
    const profile = profileFor("http://localhost:8000/sample-form");
    expect(profile).toBeDefined();

    const fields = scanForm(document, profile && { ...profile, ignore: ["notes"] });

    expect(fields.find((field) => field.id === "iban")?.hint).toContain("without spaces");
    expect(fields.some((field) => field.id === "notes")).toBe(false);
  });
});

describe("profileFor", () => {
  it("matches the sample form on any port and nothing else", () => {
    expect(profileFor("http://localhost:8000/sample-form")?.id).toBe("sample-invoice");
    expect(profileFor("https://example.com/sample-form")).toBeUndefined();
  });
});
