import type { FieldKind, FormField } from "@/lib/form/schema";
import type { FormProfile } from "@/lib/profiles";

/** Scanning stamps each control with its field id so filling finds it again without selectors. */
export const FIELD_ATTRIBUTE = "data-forms-pilot-field";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const SKIPPED_INPUT_TYPES = new Set([
  "button",
  "file",
  "hidden",
  "image",
  "password",
  "reset",
  "submit",
]);

export function scanForm(root: Document, profile?: FormProfile): FormField[] {
  const fields: FormField[] = [];
  const seen = new Set<string>();
  const ignored = new Set(profile?.ignore);

  root.querySelectorAll<Control>("input, textarea, select").forEach((control, index) => {
    if (!isFillable(control)) return;
    const id = fieldId(control, index);
    if (ignored.has(id)) return;
    control.setAttribute(FIELD_ATTRIBUTE, id);
    // Radio buttons share one field; the first one in the group describes it.
    if (seen.has(id)) return;
    seen.add(id);

    const override = profile?.fields[id];
    fields.push({
      id,
      label: override?.label ?? labelOf(control, root),
      kind: kindOf(control),
      required: isRequired(control, root),
      options: optionsOf(control, root),
      ...(override?.hint ? { hint: override.hint } : {}),
    });
  });
  return fields;
}

function isFillable(control: Control): boolean {
  if (control.disabled) return false;
  if (control instanceof HTMLInputElement) {
    if (SKIPPED_INPUT_TYPES.has(control.type) || control.readOnly) return false;
  }
  if (control instanceof HTMLTextAreaElement && control.readOnly) return false;
  return !control.closest("[hidden], [aria-hidden='true']");
}

function fieldId(control: Control, index: number): string {
  if (isRadio(control) && control.name) return control.name;
  return control.id || control.name || `field-${index}`;
}

function kindOf(control: Control): FieldKind {
  if (control instanceof HTMLSelectElement) return "select";
  if (control instanceof HTMLTextAreaElement) return "textarea";
  switch (control.type) {
    case "checkbox":
    case "radio":
    case "date":
    case "number":
    case "email":
    case "tel":
      return control.type;
    default:
      return "text";
  }
}

function labelOf(control: Control, root: Document): string {
  const labelledBy = control.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => textOf(root.getElementById(id)))
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }
  if (isRadio(control)) {
    const legend = textOf(control.closest("fieldset")?.querySelector("legend") ?? null);
    if (legend) return legend;
  }
  const ariaLabel = control.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;
  const label = textOf(control.labels?.[0] ?? null);
  if (label) return label;
  return control.getAttribute("placeholder")?.trim() || control.name || control.id;
}

/** Visible text of an element, without the text of controls nested inside it (a select's options). */
function textOf(element: Element | null): string {
  if (!element) return "";
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll("input, select, textarea").forEach((nested) => nested.remove());
  return (copy.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*\*$/, "");
}

function isRequired(control: Control, root: Document): boolean {
  if (isRadio(control)) return radioGroup(control, root).some((radio) => radio.required);
  return control.required || control.getAttribute("aria-required") === "true";
}

function optionsOf(control: Control, root: Document): string[] {
  if (control instanceof HTMLSelectElement) {
    // An empty value is the "Choose…" placeholder, not a real choice.
    return [...control.options].filter((option) => option.value !== "").map(optionText);
  }
  if (isRadio(control)) return radioGroup(control, root).map(radioText);
  return [];
}

export function optionText(option: HTMLOptionElement): string {
  return option.text.replace(/\s+/g, " ").trim();
}

export function radioText(radio: HTMLInputElement): string {
  return textOf(radio.labels?.[0] ?? null) || radio.value;
}

function radioGroup(radio: HTMLInputElement, root: Document): HTMLInputElement[] {
  return [...root.querySelectorAll<HTMLInputElement>("input[type='radio']")].filter(
    (other) => other.name === radio.name && other.form === radio.form,
  );
}

function isRadio(control: Control): control is HTMLInputElement {
  return control instanceof HTMLInputElement && control.type === "radio";
}
