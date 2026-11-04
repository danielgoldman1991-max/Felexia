"use client";

import type { FormHTMLAttributes } from "react";

function frenchMessage(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (input.validity.valueMissing) return "Ce champ est obligatoire.";
  if (input.validity.typeMismatch) return "Le format saisi n’est pas valide.";
  if (input.validity.rangeUnderflow) return "La valeur est trop petite.";
  if (input.validity.rangeOverflow) return "La valeur est trop grande.";
  if (input.validity.badInput) return "La valeur saisie n’est pas valide.";
  return "Vérifiez ce champ.";
}

export function FrenchForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      onInvalid={(event) => {
        const field = event.target as HTMLInputElement;
        if (typeof field.setCustomValidity === "function") field.setCustomValidity(frenchMessage(field));
        props.onInvalid?.(event);
      }}
      onInput={(event) => {
        const field = event.target as HTMLInputElement;
        if (typeof field.setCustomValidity === "function") field.setCustomValidity("");
        props.onInput?.(event);
      }}
    />
  );
}
