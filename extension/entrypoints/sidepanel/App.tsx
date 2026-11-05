import { useState } from "react";

import type { FillOutcome } from "@/lib/form/schema";
import { fillActiveTab, scanActiveTab, type ScanReply } from "@/lib/messages";
import { PROFILES } from "@/lib/profiles";

type PanelState =
  | { status: "idle" }
  | { status: "busy" }
  | { status: "scanned"; scan: ScanReply; outcomes?: FillOutcome[] }
  | { status: "error"; message: string };

export function App() {
  const [state, setState] = useState<PanelState>({ status: "idle" });

  async function scan() {
    setState({ status: "busy" });
    try {
      setState({ status: "scanned", scan: await scanActiveTab() });
    } catch (error) {
      setState({ status: "error", message: messageOf(error) });
    }
  }

  async function fillExamples(scan: ScanReply) {
    const profile = PROFILES.find((candidate) => candidate.id === scan.profile?.id);
    const values = Object.fromEntries(
      scan.fields.map((field) => [field.id, profile?.fields[field.id]?.example ?? ""]),
    );
    try {
      const { outcomes } = await fillActiveTab(values);
      setState({ status: "scanned", scan, outcomes });
    } catch (error) {
      setState({ status: "error", message: messageOf(error) });
    }
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-4 text-sm">
      <header>
        <h1 className="text-lg font-semibold">Forms Pilot</h1>
        <p className="text-slate-600">Drop images to fill the form on this page.</p>
      </header>

      <button
        type="button"
        className="rounded bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-50"
        disabled={state.status === "busy"}
        onClick={() => void scan()}
      >
        Scan this page
      </button>

      {state.status === "error" && <p className="text-red-700">{state.message}</p>}

      {state.status === "scanned" && (
        <section className="flex flex-col gap-2">
          <p className="text-slate-600">
            {state.scan.profile?.name ?? "Unknown form"}: {state.scan.fields.length} fields
          </p>
          <ul className="divide-y rounded border bg-white">
            {state.scan.fields.map((field) => {
              const outcome = state.outcomes?.find((item) => item.id === field.id);
              return (
                <li key={field.id} className="flex justify-between gap-2 px-2 py-1.5">
                  <span>
                    {field.label}
                    {field.required && <span className="text-red-700"> *</span>}
                  </span>
                  <span className="text-slate-500">{outcome?.status ?? field.kind}</span>
                </li>
              );
            })}
          </ul>
          {state.scan.profile && (
            <button
              type="button"
              className="rounded border px-3 py-2 font-medium"
              onClick={() => void fillExamples(state.scan)}
            >
              Fill example values
            </button>
          )}
        </section>
      )}
    </main>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
