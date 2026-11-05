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
  /** A better label when the page's own is unclear, and a hint on where to find the value. */
  fields: Record<string, { label?: string; hint?: string }>;
  /** Field ids that must never be filled, such as a captcha or a consent box. */
  ignore?: string[];
};

const sampleInvoice: FormProfile = {
  id: "sample-invoice",
  name: "Sample invoice registration",
  matches: ["http://localhost/sample-form*", "http://127.0.0.1/sample-form*"],
  fields: {
    supplier_name: { hint: "The company that issued the invoice." },
    invoice_date: { hint: "Return as YYYY-MM-DD." },
    due_date: { hint: "Return as YYYY-MM-DD." },
    total_amount: { hint: "Total including VAT, digits with a dot as decimal separator." },
    iban: { hint: "The supplier's bank account, without spaces." },
  },
};

export const PROFILES: FormProfile[] = [sampleInvoice];

export const PROFILE_MATCHES = PROFILES.flatMap((profile) => profile.matches);

export function profileFor(url: string): FormProfile | undefined {
  return PROFILES.find((profile) =>
    profile.matches.some((pattern) => new MatchPattern(pattern).includes(url)),
  );
}
