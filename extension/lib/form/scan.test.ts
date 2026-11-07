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
      ["regime_type", "Regime Type:"],
      ["declaration_type", "Declaration Type:"],
      ["cargo_channel", "Cargo Channel (Inbound):"],
      ["client_reference", "Client's Dec. Ref. No.:"],
      ["purpose", "Purpose"],
      ["exporter_code", "Exporter's Code:"],
      ["mra_aeo", "MRA AEO"],
      ["agent_code", "Agent's Code:"],
      ["cargo_handler_code", "Cargo Handler's Code:"],
      ["importing_entity", "Importing CW/FZ:"],
      ["invoice_available", "Invoice:"],
      ["packing_list_available", "Packing List:"],
      ["origin_certificate_available", "Cert. of Origin:"],
    ]);
  });

  it("describes kinds, required fields and choices", () => {
    const byId = new Map(scanForm(document).map((field) => [field.id, field]));

    expect(byId.get("client_reference")).toMatchObject({ kind: "text", required: true });
    expect(byId.get("exporter_code")).toMatchObject({ kind: "text", required: false });
    expect(byId.get("cargo_channel")?.options).toEqual(["Land", "Sea", "Air"]);
    expect(byId.get("invoice_available")?.options).toEqual(["Available", "Not Available"]);
    expect(byId.get("mra_aeo")?.kind).toBe("checkbox");
    expect(byId.has("importer_code")).toBe(false);
    expect(byId.has("trade_type")).toBe(false);
  });

  it("adds profile hints and leaves out ignored fields", () => {
    const profile = profileFor("http://localhost:8000/sample-form");
    expect(profile).toBeDefined();

    const fields = scanForm(document, profile);

    expect(fields.find((field) => field.id === "client_reference")?.hint).toContain("Not an invoice number, BOE, VIN");
    expect(fields.some((field) => field.id === "mra_aeo")).toBe(false);
  });

  it("still recognises radio groups and date labels on other forms", () => {
    document.body.innerHTML = `<form>
      <span id="date-label">Invoice date</span><input id="date" type="date" aria-labelledby="date-label" required>
      <fieldset><legend>Payment terms</legend>
        <label><input type="radio" name="terms" value="14">14 days</label>
        <label><input type="radio" name="terms" value="30">30 days</label>
      </fieldset></form>`;
    expect(scanForm(document)).toMatchObject([
      { id: "date", label: "Invoice date", kind: "date", required: true },
      { id: "terms", label: "Payment terms", kind: "radio", options: ["14 days", "30 days"] },
    ]);
  });
});

describe("profileFor", () => {
  it("matches the sample form on any port and nothing else", () => {
    expect(profileFor("http://localhost:8000/sample-form")?.id).toBe("sample-customs");
    expect(profileFor("https://example.com/sample-form")).toBeUndefined();
  });
});
