// The same page the API serves at /sample-form, so tests and manual runs share one form.
import SAMPLE_FORM from "../../../server/src/forms_pilot/sample_form.html?raw";

export function loadSampleForm(): Document {
  document.documentElement.innerHTML = SAMPLE_FORM;
  return document;
}
