import { fillForm } from "@/lib/form/fill";
import { scanForm } from "@/lib/form/scan";
import { contentRequestSchema, type FillReply, type ScanReply } from "@/lib/messages";
import { PROFILE_MATCHES, profileFor } from "@/lib/profiles";

const HIGHLIGHT_MS = 4000;

export default defineContentScript({
  // Only pages with a known profile get the script. Adding a form means adding a profile.
  matches: PROFILE_MATCHES,
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const request = contentRequestSchema.safeParse(message);
      if (!request.success) return false;

      const profile = profileFor(location.href);
      if (request.data.type === "scan") {
        const reply: ScanReply = {
          url: location.href,
          profile: profile ? { id: profile.id, name: profile.name } : null,
          fields: scanForm(document, profile),
        };
        sendResponse(reply);
      } else {
        // Scan again first: the page may have re-rendered since the panel last looked.
        scanForm(document, profile);
        const reply: FillReply = { outcomes: fillForm(document, request.data.values, highlight) };
        sendResponse(reply);
      }
      return false;
    });
  },
});

function highlight(element: HTMLElement) {
  const { outline, outlineOffset } = element.style;
  element.style.outline = "2px solid #16a34a";
  element.style.outlineOffset = "2px";
  setTimeout(() => {
    element.style.outline = outline;
    element.style.outlineOffset = outlineOffset;
  }, HIGHLIGHT_MS);
}
