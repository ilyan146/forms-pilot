import { useState } from "react";

import { FormFlow } from "./FormFlow";
import { TokenSettings } from "./TokenSettings";

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-slate-50 p-4 text-sm">
      <header className="flex items-start justify-between gap-2">
        <h1 className="text-lg font-semibold">Forms Pilot</h1>
        {!settingsOpen && (
          <button type="button" className="text-slate-600 underline" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        )}
      </header>
      {settingsOpen && <TokenSettings onDone={() => setSettingsOpen(false)} />}
      {/* Hidden rather than unmounted, so images and edits survive a visit to settings. */}
      <div hidden={settingsOpen} className="flex flex-col gap-4">
        <FormFlow onNeedToken={() => setSettingsOpen(true)} />
      </div>
    </main>
  );
}
