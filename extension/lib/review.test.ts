import { describe, expect, it } from "vitest";

import type { ExtractedValue } from "@/lib/client";
import type { FormField } from "@/lib/form/schema";
import { fillSummary, needsAttention, valuesToFill } from "@/lib/review";

function extracted(overrides: Partial<ExtractedValue> = {}): ExtractedValue {
  return {
    field_id: "iban",
    value: "NL91ABNA0417164800",
    status: "found",
    evidence: "NL91 ABNA 0417 1648 00",
    image_index: 0,
    issues: [],
    ...overrides,
  };
}

describe("needsAttention", () => {
  it("flags failed checks and ambiguous reads", () => {
    expect(needsAttention(extracted({ issues: ["Checksum"] }), "NL91ABNA0417164800")).toBe(true);
    expect(needsAttention(extracted({ status: "ambiguous" }), "NL91ABNA0417164800")).toBe(true);
    expect(needsAttention(extracted(), "NL91ABNA0417164800")).toBe(false);
  });

  it("stops flagging once the user has corrected the value", () => {
    expect(needsAttention(extracted({ issues: ["Checksum"] }), "NL91ABNA0417164300")).toBe(false);
  });
});

describe("valuesToFill", () => {
  it("drops empty values so filling never clears the page", () => {
    expect(valuesToFill({ a: "x", b: "", c: "  " })).toEqual({ a: "x" });
  });
});

describe("fillSummary", () => {
  it("names the fields the form did not take", () => {
    const fields: FormField[] = [
      { id: "a", label: "Supplier", kind: "text", required: true, options: [] },
      { id: "b", label: "Currency", kind: "select", required: true, options: ["Euro"] },
    ];

    expect(
      fillSummary(
        fields,
        [
          { id: "a", status: "filled" },
          { id: "b", status: "no_match" },
        ],
      ),
    ).toBe("Filled 1 field. Not filled: Currency.");
  });
});
