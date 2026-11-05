import { z } from "zod";

// These shapes cross the content-script message boundary, so they are Zod
// schemas first and TypeScript types second: the side panel validates what it
// receives instead of trusting another script.

export const fieldKindSchema = z.enum([
  "text",
  "textarea",
  "number",
  "date",
  "email",
  "tel",
  "select",
  "checkbox",
  "radio",
]);
export type FieldKind = z.infer<typeof fieldKindSchema>;

export const formFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: fieldKindSchema,
  required: z.boolean(),
  /** Visible choices for select and radio fields; empty otherwise. */
  options: z.array(z.string()),
  /** Extra guidance from the form profile, such as where the value appears on a document. */
  hint: z.string().optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const fillStatusSchema = z.enum(["filled", "skipped", "not_found", "no_match"]);
export type FillStatus = z.infer<typeof fillStatusSchema>;

export const fillOutcomeSchema = z.object({ id: z.string(), status: fillStatusSchema });
export type FillOutcome = z.infer<typeof fillOutcomeSchema>;
