"use client";

import { Check, ChevronDown } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
};

type CreatableComboboxProps = {
  name: string;
  options: ComboboxOption[];
  value?: string | null;
  defaultValue?: string | null;
  placeholder?: string;
  onChange?: (value: string) => void;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

export function CreatableCombobox({
  name,
  options,
  value: controlledValue,
  defaultValue,
  placeholder = "Selectionner...",
  onChange,
}: CreatableComboboxProps) {
  const isControlled = controlledValue !== undefined;
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const currentValue = isControlled ? (controlledValue ?? "") : (defaultValue ?? "");

  const selectedOption = useMemo(
    () => options.find((o) => o.value === currentValue || o.label === currentValue),
    [options, currentValue],
  );

  const filteredOptions = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter(
      (o) => normalize(o.label).includes(q) || normalize(o.value).includes(q),
    );
  }, [options, query]);

  function isExactMatch() {
    const q = normalize(query);
    return q.length > 0 && options.some((o) => normalize(o.label) === q || normalize(o.value) === q);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectValue(val: string) {
    if (isControlled && onChange) onChange(val);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && ["ArrowDown", "Enter"].includes(event.key)) {
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filteredOptions.length - 1, 0)));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) {
        selectValue(option.value);
      } else if (query.trim()) {
        selectValue(query.trim());
      }
    }

    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }

    if (event.key === "Tab") {
      if (open && query.trim() && !isExactMatch()) {
        selectValue(query.trim());
      }
      setOpen(false);
    }
  }

  function handleBlur() {
    if (query.trim() && !isExactMatch()) {
      if (isControlled && onChange) onChange(query.trim());
    }
    setTimeout(() => setQuery(""), 200);
  }

  const inputValue = open ? query : (selectedOption?.label ?? currentValue);

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={currentValue} />
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={inputValue}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setActiveIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-[100] mt-2 max-h-60 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="max-h-60 overflow-y-auto p-1.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === currentValue;
                const isActive = index === activeIndex;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectValue(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                      isActive ? "bg-indigo-50" : "hover:bg-indigo-50",
                    )}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {isSelected ? (
                        <Check className="h-4 w-4 text-indigo-600" />
                      ) : null}
                    </span>
                    <span className="text-slate-900">{option.label}</span>
                  </button>
                );
              })
            ) : query.trim() ? (
              <div className="px-3 py-3">
                <p className="text-sm text-slate-500">
                  Appuyez sur <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Entree</kbd> pour valider &ldquo;{query.trim()}&rdquo;
                </p>
              </div>
            ) : (
              <div className="px-3 py-3">
                <p className="text-sm text-slate-500">Aucun resultat</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
