import type { FillOutcome, FillStatus } from "@/lib/form/schema";
import { FIELD_ATTRIBUTE, optionText, radioText } from "@/lib/form/scan";

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "on", "checked", "x"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0", "off", "unchecked"]);

/**
 * Fill scanned fields by id. Empty values are skipped so a missing value never
 * clears what the user already typed. The form is never submitted.
 */
export function fillForm(
  root: Document,
  values: Record<string, string>,
  onFilled?: (element: HTMLElement) => void,
): FillOutcome[] {
  return Object.entries(values).map(([id, value]) => {
    const controls = [...root.querySelectorAll<HTMLElement>(`[${FIELD_ATTRIBUTE}]`)].filter(
      (element) => element.getAttribute(FIELD_ATTRIBUTE) === id,
    );
    const status = fillControls(controls, value.trim(), onFilled);
    return { id, status };
  });
}

function fillControls(
  controls: HTMLElement[],
  value: string,
  onFilled?: (element: HTMLElement) => void,
): FillStatus {
  const [first] = controls;
  if (!first) return "not_found";
  if (!value) return "skipped";

  if (first instanceof HTMLInputElement && first.type === "radio") {
    const choice = controls
      .filter((control): control is HTMLInputElement => control instanceof HTMLInputElement)
      .find((radio) => matches(value, radio.value) || matches(value, radioText(radio)));
    if (!choice) return "no_match";
    if (!choice.checked) choice.click();
    onFilled?.(choice);
    return "filled";
  }

  if (first instanceof HTMLInputElement && first.type === "checkbox") {
    const word = value.toLowerCase();
    const checked = TRUE_WORDS.has(word) ? true : FALSE_WORDS.has(word) ? false : undefined;
    if (checked === undefined) return "no_match";
    // click() goes through the browser's own toggle, which every framework listens to.
    if (first.checked !== checked) first.click();
    onFilled?.(first);
    return "filled";
  }

  if (first instanceof HTMLSelectElement) {
    const option = [...first.options].find(
      (candidate) =>
        candidate.value !== "" &&
        (matches(value, candidate.value) || matches(value, optionText(candidate))),
    );
    if (!option) return "no_match";
    setNativeValue(first, option.value);
    onFilled?.(first);
    return "filled";
  }

  if (first instanceof HTMLInputElement || first instanceof HTMLTextAreaElement) {
    setNativeValue(first, value);
    // The browser rejects values an input type cannot hold (a date not in YYYY-MM-DD).
    if (first.value !== value) return "no_match";
    onFilled?.(first);
    return "filled";
  }

  return "not_found";
}

/**
 * React, Vue and Angular keep their own copy of a field's value. Assigning
 * `element.value` directly updates React's tracker too, so React thinks nothing
 * changed and drops the update. Calling the prototype's setter and then firing
 * the events a real keystroke would fire keeps every framework in sync.
 */
function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  element.focus();
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.blur();
}

function matches(value: string, candidate: string): boolean {
  return value.localeCompare(candidate.trim(), undefined, { sensitivity: "accent" }) === 0;
}
