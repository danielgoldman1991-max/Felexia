"use client";

import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  id: string;
  label: string;
};

type ComboboxCreateProps = {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  createLabel?: string;
  onCreate: () => void;
  disabled?: boolean;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

export function ComboboxCreate({
  options,
  value,
  onChange,
  placeholder = "Rechercher...",
  createLabel = "+ Créer",
  onCreate,
  disabled = false,
}: ComboboxCreateProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedOption = options.find((o) => o.id === value) ?? null;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (normalizedQuery.length === 0) return options;
    return options.filter((o) =>
      normalize(o.label).includes(normalizedQuery),
    );
  }, [options, query]);

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

  function selectOption(option: ComboboxOption) {
    onChange(option.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (!open && ["ArrowDown", "Enter"].includes(event.key)) {
      setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(filteredOptions.length, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      const item = filteredOptions[activeIndex];
      if (item) selectOption(item);
    }
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  const inputValue = open ? query : selectedOption ? selectedOption.label : "";

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          disabled={disabled}
          value={inputValue}
          placeholder={placeholder}
          onFocus={() => {
            if (disabled) return;
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
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white py-2 pl-9 pr-10 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
      </div>

      {open && !disabled ? (
        <div
          role="listbox"
          className="absolute z-[100] mt-2 max-h-80 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="max-h-60 overflow-y-auto p-1.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const selected = option.id === value;
                const active = index === activeIndex;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                      active ? "bg-indigo-50" : "hover:bg-indigo-50",
                    )}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-indigo-600">
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span className="truncate text-sm font-medium text-slate-900">
                      {option.label}
                    </span>
                  </button>
                );
              })
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
          >
            <Plus className="h-4 w-4" />
            {createLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
