"use client";

import Link from "next/link";
import { Check, ChevronDown, Search } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type CustomerOption = {
  id: string;
  name: string;
  commercial_name?: string | null;
  ice?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
};

type CustomerComboboxProps = {
  customers: CustomerOption[];
  value: string;
  onChange: (customerId: string) => void;
  name?: string;
  placeholder?: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function secondaryLine(customer: CustomerOption) {
  return [
    customer.ice ? `ICE: ${customer.ice}` : null,
    customer.city,
    customer.phone,
    customer.email,
  ].filter(Boolean).join(" · ");
}

export function CustomerCombobox({
  customers,
  value,
  onChange,
  name,
  placeholder = "Rechercher un client...",
}: CustomerComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedCustomer = customers.find((customer) => customer.id === value) ?? null;

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = normalize(query);
    const source = normalizedQuery.length === 0
      ? customers
      : customers.filter((customer) =>
          [
            customer.name,
            customer.commercial_name,
            customer.ice,
            customer.email,
            customer.phone,
            customer.city,
          ]
            .filter(Boolean)
            .some((field) => normalize(field).includes(normalizedQuery)),
        );

    return source.slice(0, 20);
  }, [customers, query]);

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

  function selectCustomer(customer: CustomerOption) {
    onChange(customer.id);
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
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredCustomers.length - 1, 0)));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const customer = filteredCustomers[activeIndex];
      if (customer) selectCustomer(customer);
    }

    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  const inputValue = open ? query : selectedCustomer?.name ?? "";

  return (
    <div ref={rootRef} className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="customer-combobox-listbox"
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
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white py-2 pl-9 pr-10 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
      </div>

      {open ? (
        <div
          id="customer-combobox-listbox"
          role="listbox"
          className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-1 shadow-[var(--shadow-md)]"
        >
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer, index) => {
              const selected = customer.id === value;
              const active = index === activeIndex;

              return (
                <button
                  key={customer.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectCustomer(customer)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left transition",
                    active ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-soft)]",
                  )}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[var(--secondary)]">
                    {selected ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                      {customer.name}
                    </span>
                    {secondaryLine(customer) ? (
                      <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                        {secondaryLine(customer)}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3">
              <p className="text-sm font-medium text-[var(--foreground)]">Aucun client trouve</p>
              <Link
                href="/tiers/new?type=customer"
                className="mt-2 inline-flex text-sm font-medium text-[var(--secondary)] hover:text-[var(--primary)]"
              >
                Creer un client
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {selectedCustomer ? (
        <p className="mt-1 text-xs text-[var(--muted)]">
          Client selectionne : {selectedCustomer.name}
        </p>
      ) : null}
    </div>
  );
}
