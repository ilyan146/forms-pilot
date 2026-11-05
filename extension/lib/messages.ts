import { z } from "zod";

import { fillOutcomeSchema, formFieldSchema } from "@/lib/form/schema";

// The side panel and the content script run in different worlds and talk only
// through messages. Every message and reply is validated on arrival.

export const contentRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("scan") }),
  z.object({ type: z.literal("fill"), values: z.record(z.string(), z.string()) }),
]);
export type ContentRequest = z.infer<typeof contentRequestSchema>;

export const scanReplySchema = z.object({
  url: z.string(),
  profile: z.object({ id: z.string(), name: z.string() }).nullable(),
  fields: z.array(formFieldSchema),
});
export type ScanReply = z.infer<typeof scanReplySchema>;

export const fillReplySchema = z.object({ outcomes: z.array(fillOutcomeSchema) });
export type FillReply = z.infer<typeof fillReplySchema>;

export class NoFormError extends Error {
  constructor() {
    super("Forms Pilot does not support this page. Open the form and try again.");
  }
}

async function sendToActiveTab(request: ContentRequest): Promise<unknown> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new NoFormError();
  try {
    return await browser.tabs.sendMessage(tab.id, request);
  } catch {
    // No content script answered: the page is not a supported form, or it was
    // open before the extension was installed and needs a reload.
    throw new NoFormError();
  }
}

export async function scanActiveTab(): Promise<ScanReply> {
  return scanReplySchema.parse(await sendToActiveTab({ type: "scan" }));
}

export async function fillActiveTab(values: Record<string, string>): Promise<FillReply> {
  return fillReplySchema.parse(await sendToActiveTab({ type: "fill", values }));
}
