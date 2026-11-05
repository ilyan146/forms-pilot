import type { ExtractedValue } from "@/lib/client";
import type { FillOutcome, FormField } from "@/lib/form/schema";

/** What the user is about to fill, by field id. Starts as what the model read. */
export type Draft = Record<string, string>;

export function draftFrom(values: ExtractedValue[]): Draft {
  return Object.fromEntries(values.map((value) => [value.field_id, value.value]));
}

/**
 * A field needs a look when a check failed or the model saw several candidates.
 * An edited field does not: the user has already looked.
 */
export function needsAttention(extracted: ExtractedValue | undefined, draftValue: string): boolean {
  if (!extracted || isEdited(extracted, draftValue)) return false;
  return extracted.status === "ambiguous" || extracted.issues.length > 0;
}

export function isEdited(extracted: ExtractedValue | undefined, draftValue: string): boolean {
  return (extracted?.value ?? "") !== draftValue;
}

/** Only non-empty values are sent, so filling never clears what is already on the page. */
export function valuesToFill(draft: Draft): Draft {
  return Object.fromEntries(
    Object.entries(draft).filter(([, value]) => value.trim() !== ""),
  );
}

const OUTCOME_TEXT: Record<FillOutcome["status"], string> = {
  filled: "Filled",
  skipped: "Left empty",
  not_found: "Field no longer on the page",
  no_match: "The form did not accept this value",
};

export function outcomeText(outcome: FillOutcome): string {
  return OUTCOME_TEXT[outcome.status];
}

export function fillSummary(fields: FormField[], outcomes: FillOutcome[]): string {
  const filled = outcomes.filter((outcome) => outcome.status === "filled").length;
  const failed = outcomes
    .filter((outcome) => outcome.status === "not_found" || outcome.status === "no_match")
    .map((outcome) => fields.find((field) => field.id === outcome.id)?.label ?? outcome.id);
  const base = `Filled ${filled} ${filled === 1 ? "field" : "fields"}.`;
  return failed.length > 0 ? `${base} Not filled: ${failed.join(", ")}.` : base;
}
