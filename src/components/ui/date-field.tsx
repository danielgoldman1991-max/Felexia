"use client";

import { useState, useCallback, useId, useRef, type InputHTMLAttributes } from "react";
import { Calendar } from "lucide-react";
import { formatIsoDateToFr, parseFrDateToIso } from "@/lib/date-format";

type DateFieldProps = {
  name?: string;
  value?: string | null;
  onChange?: (iso: string) => void;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  label?: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, "id" | "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid">;

export function DateField({
  id,
  name,
  value: controlledValue,
  onChange,
  defaultValue,
  required,
  disabled,
  placeholder = "jj/mm/aaaa",
  className = "",
  label,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: DateFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const isControlled = controlledValue !== undefined;
  const [internalIso, setInternalIso] = useState(() => {
    if (isControlled) return "";
    return defaultValue ?? "";
  });
  const [rawOverride, setRawOverride] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const nativePickerRef = useRef<HTMLInputElement>(null);

  const display = rawOverride !== null
    ? rawOverride
    : isControlled
      ? formatIsoDateToFr(controlledValue ?? "")
      : formatIsoDateToFr(internalIso);

  const currentIso = isControlled ? (controlledValue ?? "") : internalIso;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setRawOverride(raw);
      const iso = parseFrDateToIso(raw);
      setError(raw.trim() && !iso && raw.replace(/\D/g, "").length >= 8 ? "Cette date n’existe pas. Vérifiez le jour et le mois." : null);
      if (!isControlled && iso) {
        setInternalIso(iso);
      }
      if (isControlled && iso && onChange) onChange(iso);
    },
    [isControlled, onChange]
  );

  const handleBlur = useCallback(() => {
    if (rawOverride && rawOverride.trim() && !parseFrDateToIso(rawOverride)) {
      setError("Cette date n’existe pas. Vérifiez le jour et le mois.");
      return;
    }
    setError(null);
    setRawOverride(null);
  }, [rawOverride]);

  function handleNativePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value;
    if (!iso) return;
    setRawOverride(null);
    setError(null);
    if (!isControlled) setInternalIso(iso);
    if (isControlled && onChange) onChange(iso);
  }

  function openPicker() {
    if (disabled) return;
    const input = nativePickerRef.current;
    if (!input) return;
    if (currentIso) input.value = currentIso;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
  }

  return (
    <div className={className}>
      {label ? <label htmlFor={inputId} className="block text-sm font-medium text-[var(--muted)]">{label}</label> : null}
      <div className="relative mt-1">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={[ariaDescribedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined}
          className="ui-input block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label={label ? `Ouvrir le calendrier : ${label}` : "Ouvrir le calendrier"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:text-slate-300"
        >
          <Calendar aria-hidden="true" className="h-4 w-4" />
        </button>
        <input
          ref={nativePickerRef}
          type="date"
          disabled={disabled}
          onChange={handleNativePickerChange}
          className="pointer-events-none absolute right-0 top-0 h-px w-px opacity-0"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      {error ? <p id={errorId} role="alert" className="mt-1 text-sm text-red-700">{error}</p> : null}
      {name ? (
        <input ref={hiddenRef} type="hidden" name={name} value={currentIso} />
      ) : null}
    </div>
  );
}
