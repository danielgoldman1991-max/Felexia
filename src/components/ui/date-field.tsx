"use client";

import { useState, useCallback, useRef } from "react";
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
};

export function DateField({
  name,
  value: controlledValue,
  onChange,
  defaultValue,
  required,
  disabled,
  placeholder = "jj/mm/aaaa",
  className = "",
  label,
}: DateFieldProps) {
  const isControlled = controlledValue !== undefined;
  const [internalIso, setInternalIso] = useState(() => {
    if (isControlled) return "";
    return defaultValue ?? "";
  });
  const [rawOverride, setRawOverride] = useState<string | null>(null);
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
      if (!isControlled && iso) {
        setInternalIso(iso);
      }
      if (isControlled && iso && onChange) onChange(iso);
    },
    [isControlled, onChange]
  );

  const handleBlur = useCallback(() => {
    setRawOverride(null);
  }, []);

  function handleNativePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value;
    if (!iso) return;
    setRawOverride(null);
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
      {label ? <label className="text-xs font-medium uppercase text-[var(--muted)]">{label}</label> : null}
      <div className="relative mt-1">
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label="Ouvrir le calendrier"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-700 disabled:text-slate-300"
          tabIndex={-1}
        >
          <Calendar className="h-4 w-4" />
        </button>
        <input
          ref={nativePickerRef}
          type="date"
          onChange={handleNativePickerChange}
          className="absolute right-0 top-0 h-full w-14 opacity-0"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      {name ? (
        <input ref={hiddenRef} type="hidden" name={name} value={currentIso} />
      ) : null}
    </div>
  );
}
