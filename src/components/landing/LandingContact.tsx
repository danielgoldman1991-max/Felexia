"use client";

import { Check, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const promises = [
  "Réponse rapide de notre équipe",
  "Démonstration personnalisée de votre activité",
  "Accompagnement pour démarrer l'essai Essentiel",
];

export function LandingContact() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    // TODO: connecter le formulaire à un Server Action ou une table
    window.setTimeout(() => setStatus("sent"), 800);
  }

  return (
    <section id="contact" className="scroll-mt-24 bg-[#F8FBFF] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[#1E66D0]">
                Contact
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B2A5B] sm:text-4xl">
                Vous voulez voir FelexiaERP en action ?
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Vous hésitez entre plusieurs modules ou vous voulez voir Felexia en action ?
                Décrivez-nous votre activité, nous vous répondons rapidement.
              </p>
              <ul className="mt-8 space-y-3">
                {promises.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-blue-900/5">
              {status === "sent" ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <Check className="h-8 w-8 text-emerald-600" />
                  </span>
                  <h3 className="mt-6 text-xl font-bold text-slate-900">Merci !</h3>
                  <p className="mt-2 max-w-sm text-sm text-slate-600">
                    Votre demande a bien été enregistrée. Notre équipe reviendra vers vous
                    rapidement.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="grid gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contact-nom" className="mb-1.5 block text-sm font-medium text-slate-700">
                        Nom <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="contact-nom"
                        name="nom"
                        required
                        placeholder="Votre nom complet"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-entreprise" className="mb-1.5 block text-sm font-medium text-slate-700">
                        Entreprise
                      </label>
                      <input
                        id="contact-entreprise"
                        name="entreprise"
                        placeholder="Nom de votre entreprise"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                        Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        required
                        placeholder="vous@entreprise.ma"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-telephone" className="mb-1.5 block text-sm font-medium text-slate-700">
                        Téléphone
                      </label>
                      <input
                        id="contact-telephone"
                        name="telephone"
                        type="tel"
                        placeholder="+212 6 XX XX XX XX"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Message <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      required
                      rows={5}
                      placeholder="Décrivez votre activité et vos besoins..."
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={status === "sending"}
                    variant="landingPrimary"
                    className="h-12 px-7"
                  >
                    <Send className="relative z-10 h-4 w-4 !text-white" />
                    <span className="relative z-10 !text-white">
                      {status === "sending" ? "Envoi en cours..." : "Envoyer la demande"}
                    </span>
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
