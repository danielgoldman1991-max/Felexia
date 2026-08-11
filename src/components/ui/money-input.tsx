"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { canonicalMoney, moneyInputText, parseLocalizedMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "name" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"
> & {
  name: string;
  value?: number | null;
  defaultValue?: number | string | null;
  min?: number;
  max?: number;
  currency?: string;
  onValueChange?: (value: number | null) => void;
};

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    {
      name,
      value,
      defaultValue,
      min,
      max,
      currency = "MAD",
      onValueChange,
      className,
      id,
      required,
      disabled,
      onBlur,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const internalRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => internalRef.current as HTMLInputElement);
    const controlled = value !== undefined;
    const [textValue, setTextValue] = useState(() => moneyInputText(value ?? defaultValue));

    useEffect(() => {
      if (controlled) setTextValue(moneyInputText(value));
    }, [controlled, value]);

    const parsed = parseLocalizedMoney(textValue);
    const withinRange =
      parsed !== null &&
      (min === undefined || parsed >= min) &&
      (max === undefined || parsed <= max);
    const canonicalValue = withinRange ? canonicalMoney(parsed) : "";

    useEffect(() => {
      const input = internalRef.current;
      if (!input) return;
      const missing = required && textValue.trim() === "";
      input.setCustomValidity(
        missing
          ? "Saisissez un montant."
          : textValue !== "" && !withinRange
            ? `Saisissez un montant${min !== undefined ? ` supérieur ou égal à ${moneyInputText(min)}` : ""}${max !== undefined ? ` inférieur ou égal à ${moneyInputText(max)}` : ""}.`
            : "",
      );
    }, [max, min, required, textValue, withinRange]);

    return (
      <div className="relative">
        <Input
          {...props}
          ref={internalRef}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={textValue}
          required={required}
          disabled={disabled}
          aria-invalid={textValue !== "" && !withinRange ? true : undefined}
          className={cn("pr-14 tabular-nums", className)}
          onChange={(event) => {
            const nextText = event.target.value;
            if (!/^-?[\d\s\u00a0\u202f]*(?:[,.]\d{0,2})?$/.test(nextText)) return;
            setTextValue(nextText);
            const nextValue = parseLocalizedMoney(nextText);
            onValueChange?.(nextValue);
          }}
          onBlur={(event) => {
            const nextValue = parseLocalizedMoney(event.currentTarget.value);
            if (nextValue !== null) setTextValue(moneyInputText(nextValue));
            onBlur?.(event);
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-[var(--muted)]"
        >
          {currency}
        </span>
        <input
          type="hidden"
          name={name}
          value={canonicalValue}
          disabled={disabled}
          readOnly
        />
      </div>
    );
  },
);
