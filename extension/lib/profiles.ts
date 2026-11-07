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

const sampleCustoms: FormProfile = {
  id: "sample-customs",
  name: "Sample customs declaration — General Information",
  matches: ["http://localhost/sample-form*", "http://127.0.0.1/sample-form*"],
  fields: {
    regime_type: { hint: "Use only an explicitly stated customs regime. Do not infer it from the filename." },
    declaration_type: { hint: "Use an explicitly stated declaration type matching a choice. Do not invent a customs classification." },
    cargo_channel: { hint: "Inbound transport mode: ROAD corresponds to Land. Do not use vehicle model or port name to guess." },
    client_reference: { hint: "The client's own declaration reference, only if explicitly labelled. Not an invoice number, BOE, VIN or customs declaration number." },
    purpose: { hint: "The explicitly stated shipment purpose. A Commercial licence alone does not establish the purpose." },
    exporter_code: { hint: "The exporter's customs registration code, not the company name, licence number, VIN or BOE." },
    agent_code: { hint: "The clearing agent's explicitly labelled customs code. Do not substitute their name or licence number." },
    cargo_handler_code: { hint: "The cargo handler's explicitly labelled registration code. Do not use an engine number or HS code." },
    importing_entity: { hint: "The destination importing customs warehouse or free zone (CW/FZ), not the exit port or exporter's address." },
    invoice_available: { hint: "Available only if an invoice is present among the uploaded sources. Otherwise leave missing; do not assume Not Available." },
    packing_list_available: { hint: "Available only if a source is explicitly identified as a packing list. A vehicle spreadsheet alone is insufficient. Otherwise leave missing." },
    origin_certificate_available: { hint: "Available only if a certificate of origin is present. A Country/Origin column is not a certificate. Otherwise leave missing." },
  },
  ignore: ["mra_aeo"],
};

export const PROFILES: FormProfile[] = [sampleCustoms];

export const PROFILE_MATCHES = PROFILES.flatMap((profile) => profile.matches);

export function profileFor(url: string): FormProfile | undefined {
  return PROFILES.find((profile) =>
    profile.matches.some((pattern) => new MatchPattern(pattern).includes(url)),
  );
}
