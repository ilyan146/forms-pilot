import type { ReactNode } from "react";

type ButtonProps = { onClick: () => void; disabled?: boolean; children: ReactNode };

export function PrimaryButton({ onClick, disabled, children }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ onClick, disabled, children }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex-1 rounded border bg-white px-3 py-2 font-medium disabled:opacity-50"
    >
      {children}
    </button>
  );
}
