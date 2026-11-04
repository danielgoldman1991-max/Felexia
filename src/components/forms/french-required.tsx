"use client";

import { useEffect } from "react";

function isField(target: EventTarget | null): target is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function frenchMessage(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (field.validity.valueMissing) return "Ce champ est obligatoire.";
  if (field instanceof HTMLInputElement && field.validity.typeMismatch && field.type === "email") return "Saisissez une adresse e-mail valide.";
  if (field.validity.rangeUnderflow || field.validity.rangeOverflow) return "La valeur est hors limites.";
  if (field.validity.tooShort || field.validity.tooLong) return "La longueur de ce champ n'est pas valide.";
  if (field.validity.patternMismatch) return "Le format n'est pas valide.";
  if (field.validity.stepMismatch) return "La valeur n'est pas un pas autorisé.";
  return "Vérifiez ce champ.";
}

/** Replace the browser's English required bubble on every form. */
export function FrenchRequired() {
  useEffect(() => {
    const onInvalid = (event: Event) => {
      if (!isField(event.target)) return;
      event.target.setCustomValidity(frenchMessage(event.target));
    };
    const clear = (event: Event) => {
      if (!isField(event.target)) return;
      event.target.setCustomValidity("");
    };
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", clear, true);
    document.addEventListener("change", clear, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", clear, true);
      document.removeEventListener("change", clear, true);
    };
  }, []);
  return null;
}
