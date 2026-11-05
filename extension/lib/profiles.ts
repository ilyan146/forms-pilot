import { MatchPattern } from "wxt/utils/match-patterns";

/**
 * What we know about one specific form, beyond what the page itself says.
 * Fields are found on the page by scanning; a profile only adds guidance by
 * field id (the control's `id`, or its `name` for radio groups).
 */
export type FormProfile = {
  id: string;
  name: string;
  /** Chrome match patterns. A pattern without a port matches every port. */
  matches: string[];
  fields: Record<string, { label?: string; hint?: string; example?: string }>;
  /** Field ids that must never be filled, such as a captcha or a consent box. */
  ignore?: string[];
};

const sampleInvoice: FormProfile = {
  id: "sample-invoice",
  name: "Sample invoice registration",
  matches: ["http://localhost/sample-form*", "http://127.0.0.1/sample-form*"],
  fields: {
    supplier_name: { hint: "The company that issued the invoice.", example: "Acme Dredging B.V." },
    invoice_number: { example: "INV-2026-0042" },
    invoice_date: { hint: "Return as YYYY-MM-DD.", example: "2026-10-28" },
    due_date: { hint: "Return as YYYY-MM-DD.", example: "2026-11-27" },
    currency: { example: "EUR" },
    total_amount: {
      hint: "Total including VAT, digits with a dot as decimal separator.",
      example: "12500.00",
    },
    vat_number: { example: "NL123456789B01" },
    iban: { hint: "The supplier's bank account, without spaces.", example: "NL91ABNA0417164300" },
    payment_terms: { example: "30 days" },
    po_reference: { example: "PO-77812" },
    notes: { example: "Mobilisation of equipment, phase 1." },
    urgent: { example: "no" },
  },
};

export const PROFILES: FormProfile[] = [sampleInvoice];

export const PROFILE_MATCHES = PROFILES.flatMap((profile) => profile.matches);

export function profileFor(url: string): FormProfile | undefined {
  return PROFILES.find((profile) =>
    profile.matches.some((pattern) => new MatchPattern(pattern).includes(url)),
  );
}
