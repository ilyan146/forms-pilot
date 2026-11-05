import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { API_URL, apiToken, errorMessage } from "@/lib/api";

import { PrimaryButton, SecondaryButton } from "./buttons";

const TOKEN_KEY = ["apiToken"];

export function TokenSettings({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: TOKEN_KEY, queryFn: () => apiToken.getValue() });
  const [draft, setDraft] = useState("");
  const save = useMutation({
    mutationFn: (token: string) => apiToken.setValue(token.trim()),
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: TOKEN_KEY });
    },
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">API token</h2>
      <p className="text-slate-600">
        Ask your administrator for a personal token for {API_URL}. It is stored on this device only.
      </p>
      <p>{saved.data ? "A token is saved." : "No token saved yet."}</p>
      <label className="flex flex-col gap-1">
        <span className="font-medium">{saved.data ? "Replace token" : "Token"}</span>
        <input
          type="password"
          autoComplete="off"
          className="rounded border px-2 py-1"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      {save.isError && <p className="text-red-700">{errorMessage(save.error)}</p>}
      <PrimaryButton disabled={draft.trim() === "" || save.isPending} onClick={() => save.mutate(draft)}>
        Save token
      </PrimaryButton>
      <div className="flex gap-2">
        {saved.data && <SecondaryButton onClick={() => save.mutate("")}>Remove token</SecondaryButton>}
        <SecondaryButton onClick={onDone}>Back</SecondaryButton>
      </div>
    </section>
  );
}
