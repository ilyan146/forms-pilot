import type { ExtractedValue, SourceInfo } from "@/lib/client";
import type { FillOutcome, FormField } from "@/lib/form/schema";
import { isEdited, needsAttention, outcomeText, type Draft } from "@/lib/review";

type Props = {
  fields: FormField[];
  values: ExtractedValue[];
  sources: SourceInfo[];
  draft: Draft;
  outcomes: FillOutcome[] | undefined;
  onChange: (id: string, value: string) => void;
};

export function ReviewList({ fields, values, sources, draft, outcomes, onChange }: Props) {
  const attention = fields.filter((field) =>
    needsAttention(byId(values, field.id), draft[field.id] ?? ""),
  ).length;

  return (
    <section className="flex flex-col gap-2">
      <p className={attention > 0 ? "font-medium text-amber-800" : "text-slate-600"}>
        {attention > 0
          ? `${attention} ${attention === 1 ? "field needs" : "fields need"} a look before filling.`
          : "Check the values, then fill the form."}
      </p>
      <ul className="flex flex-col gap-2">
        {fields.map((field) => {
          const extracted = byId(values, field.id);
          const value = draft[field.id] ?? "";
          const flagged = needsAttention(extracted, value);
          const outcome = outcomes?.find((item) => item.id === field.id);
          return (
            <li
              key={field.id}
              className={`flex flex-col gap-1 rounded border p-2 ${
                flagged ? "border-amber-400 bg-amber-50" : "bg-white"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={`review-${field.id}`} className="font-medium">
                  {field.label}
                  {field.required && <span className="text-red-700"> *</span>}
                </label>
                <Badge extracted={extracted} value={value} flagged={flagged} />
              </div>
              <FieldInput field={field} value={value} onChange={(next) => onChange(field.id, next)} />
              {extracted?.evidence && (
                <p className="text-xs text-slate-500">
                  Read “{extracted.evidence}”
                  {extracted.image_index != null && ` in ${sourceLabel(sources[extracted.image_index], extracted.image_index)}`}
                </p>
              )}
              {flagged &&
                extracted?.issues.map((issue) => (
                  <p key={issue} className="text-xs text-amber-800">
                    {issue}
                  </p>
                ))}
              {flagged && extracted?.status === "ambiguous" && extracted.issues.length === 0 && (
                <p className="text-xs text-amber-800">The documents show more than one candidate.</p>
              )}
              {outcome && (
                <p className={`text-xs ${outcome.status === "filled" ? "text-green-700" : "text-red-700"}`}>
                  {outcomeText(outcome)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Badge({
  extracted,
  value,
  flagged,
}: {
  extracted: ExtractedValue | undefined;
  value: string;
  flagged: boolean;
}) {
  const [text, style] = flagged
    ? ["Check", "bg-amber-200 text-amber-900"]
    : isEdited(extracted, value)
      ? ["Edited", "bg-blue-100 text-blue-900"]
      : extracted?.status === "found"
        ? ["Read", "bg-green-100 text-green-900"]
        : ["Not found", "bg-slate-100 text-slate-600"];
  return <span className={`rounded px-1.5 text-xs ${style}`}>{text}</span>;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `review-${field.id}`;
  const className = "w-full rounded border px-2 py-1";
  const choices =
    field.kind === "checkbox" ? ["yes", "no"] : field.kind === "select" || field.kind === "radio" ? field.options : null;

  if (choices) {
    return (
      <select id={id} className={className} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Leave as is</option>
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
        {/* Keep an unmatched model value visible so the user can see what was read. */}
        {value !== "" && !choices.includes(value) && <option value={value}>{value}</option>}
      </select>
    );
  }
  if (field.kind === "textarea") {
    return (
      <textarea id={id} className={className} rows={2} value={value} onChange={(event) => onChange(event.target.value)} />
    );
  }
  return <input id={id} className={className} value={value} onChange={(event) => onChange(event.target.value)} />;
}

function byId(values: ExtractedValue[], id: string) {
  return values.find((value) => value.field_id === id);
}

function sourceLabel(source: SourceInfo | undefined, index: number): string {
  if (!source) return `source ${index + 1}`;
  if (source.page != null) return `${source.name}, page ${source.page}`;
  if (source.sheet != null) return `${source.name}, sheet ${source.sheet}`;
  return source.name;
}
