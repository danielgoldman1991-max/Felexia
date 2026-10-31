"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Check, CheckCircle2, ChevronLeft, Hash, History, Info, Loader2, LockKeyhole, Pencil, ReceiptText, RefreshCw, Search, ShieldCheck, ShoppingCart, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/erp/empty-state";
import type { NumberingActionState, NumberingCounter, NumberingGroup, NumberingSettingsData } from "@/lib/numbering-types";

type SaveAction = (previous: NumberingActionState, formData: FormData) => Promise<NumberingActionState>;
const initialState: NumberingActionState = { success: false, error: null };
const groups = [
  { key: "sales", label: "Ventes", description: "Documents adressés à vos clients.", icon: ReceiptText },
  { key: "purchases", label: "Achats", description: "Factures et règlements de vos fournisseurs.", icon: ShoppingCart },
  { key: "contacts", label: "Contacts", description: "Codes de vos clients et fournisseurs.", icon: Users },
  { key: "accounting", label: "Journaux", description: "Numéros des écritures de vos journaux.", icon: BookOpen },
  { key: "other", label: "Autres documents", description: "Compteurs des modules complémentaires.", icon: Hash },
] as const;

function nextExample(counter: NumberingCounter, next: number) {
  return counter.numberPattern.replace("{NUMBER}", String(next).padStart(counter.numberWidth ?? 5, "0"));
}

function CounterRow({ counter, canEdit, saveAction, selectedPeriod }: { counter: NumberingCounter; canEdit: boolean; saveAction: SaveAction; selectedPeriod: string }) {
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [next, setNext] = useState(String(counter.nextNumber));
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(async (previous: NumberingActionState, data: FormData) => {
    try {
      const result = await saveAction(previous, data);
      if (result.success) {
        setEditing(false);
        setReviewing(false);
        setReason("");
        toast.success(result.message || "Le compteur a été corrigé.");
      } else {
        setReviewing(false);
        setValidationError(result.error);
      }
      return result;
    } catch {
      const error = "Impossible de confirmer la correction. Actualisez les compteurs pour vérifier le résultat avant de réessayer.";
      setReviewing(false);
      setValidationError(error);
      return { success: false, error };
    }
  }, initialState);
  const item = state.counter ?? counter;
  const nextValue = Number(next);
  const proposedExample = Number.isSafeInteger(nextValue) && nextValue > 0 ? nextExample(item, nextValue) : "—";
  const changeAllowed = canEdit && item.editable !== false;

  function startEditing() {
    setNext(String(item.nextNumber));
    setReason("");
    setReviewing(false);
    setValidationError(null);
    setEditing(true);
  }

  function reviewChange() {
    if (!/^\d+$/.test(next) || !Number.isSafeInteger(nextValue) || nextValue < item.minNextNumber || (item.maxNextNumber !== undefined && nextValue > item.maxNextNumber)) {
      setValidationError(`Indiquez un entier compris entre ${item.minNextNumber} et ${item.maxNextNumber ?? "la limite du compteur"}.`);
      return;
    }
    if (nextValue === item.nextNumber) {
      setValidationError("Indiquez un prochain numéro différent du compteur actuel.");
      return;
    }
    if (reason.trim().length < 5) {
      setValidationError("Précisez le motif de la correction en quelques mots (5 caractères minimum).");
      return;
    }
    setValidationError(null);
    setReviewing(true);
  }

  return <article className="px-5 py-5">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{item.label}</h3>
        {item.description ? <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.description}</p> : null}
      </div>
      {changeAllowed && !editing ? <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={startEditing} aria-label={`Corriger le compteur ${item.label}`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Corriger</Button> : null}
      {editing ? <Button type="button" variant="ghost" className="h-8 w-8 px-0" disabled={pending} onClick={() => setEditing(false)} aria-label={`Fermer la correction ${item.label}`}><X className="h-4 w-4" aria-hidden="true" /></Button> : null}
    </div>

    <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]"><History className="h-3.5 w-3.5" aria-hidden="true" />Dernier numéro utilisé</p>
        <p className="mt-1.5 break-all font-mono text-sm font-medium text-[var(--foreground)]">{item.lastUsedNumber || "Aucun document pour cette période"}</p>
      </div>
      <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--primary-soft)] px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]"><ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />Prochain numéro</p>
        <p className="mt-1.5 break-all font-mono text-sm font-semibold text-[var(--primary)]">{item.nextExample}</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
      <span>{item.periodLabel}</span><span aria-hidden="true">·</span><span>Préfixe <span className="font-mono font-medium text-[var(--foreground)]">{item.prefix}</span></span>
      {item.issue ? <Badge tone="warning">À vérifier</Badge> : null}
    </div>
    {item.issue ? <p className="mt-3 rounded-lg border border-[var(--warning)]/20 bg-[var(--warning-soft)] px-3 py-2 text-xs leading-5 text-[var(--foreground)]">{item.issue}</p> : null}

    {editing ? <form action={formAction} onSubmit={(event) => { if (!reviewing) { event.preventDefault(); reviewChange(); } }} className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <input type="hidden" name="counterKey" value={item.key} />
      <input type="hidden" name="expectedRevision" value={item.revision} />
      <input type="hidden" name="period" value={selectedPeriod} />
      {reviewing ? <>
        <input type="hidden" name="nextNumber" value={next} />
        <input type="hidden" name="reason" value={reason.trim()} />
        <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />Vérifier la correction</p>
        <div className="mt-4 grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="min-w-0"><p className="text-xs text-[var(--muted)]">Prochain numéro actuel</p><p className="mt-1 break-all font-mono text-sm font-medium">{item.nextExample}</p></div>
          <ArrowRight className="hidden h-4 w-4 text-[var(--muted)] sm:block" aria-hidden="true" />
          <div className="min-w-0"><p className="text-xs text-[var(--muted)]">Après correction</p><p className="mt-1 break-all font-mono text-sm font-semibold text-[var(--primary)]">{proposedExample}</p></div>
        </div>
        <p className="mt-4 break-words text-xs leading-5 text-[var(--muted)]"><strong className="font-medium text-[var(--foreground)]">Motif :</strong> {reason.trim()}</p>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Ce numéro sera utilisé pour le prochain document de cette série ({item.periodLabel}). La correction sera enregistrée dans l’historique.</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" className="h-9 text-xs" disabled={pending} onClick={() => setReviewing(false)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />Modifier la saisie</Button>
          <Button type="submit" className="h-9 text-xs" disabled={pending}>{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}{pending ? "Correction…" : "Confirmer la correction"}</Button>
        </div>
      </> : <>
        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div><label htmlFor={`${fieldId}-next`} className="mb-1.5 block text-xs font-medium">Prochain compteur</label><Input id={`${fieldId}-next`} name="nextNumber" inputMode="numeric" type="number" min={item.minNextNumber} max={item.maxNextNumber} step={1} value={next} onChange={(event) => { setNext(event.target.value); setValidationError(null); }} required aria-describedby={`${fieldId}-minimum`} /><p id={`${fieldId}-minimum`} className="mt-1.5 text-[11px] leading-5 text-[var(--muted)]">Minimum disponible : {item.minNextNumber}</p></div>
          <div><label htmlFor={`${fieldId}-reason`} className="mb-1.5 block text-xs font-medium">Motif de la correction</label><Input id={`${fieldId}-reason`} name="reason" value={reason} minLength={5} maxLength={500} onChange={(event) => { setReason(event.target.value); setValidationError(null); }} placeholder="Ex. Reprise de ma numérotation existante" required /><p className="mt-1.5 text-[11px] leading-5 text-[var(--muted)]">Indiquez pourquoi vous corrigez ce compteur.</p></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 text-xs text-[var(--muted)]">Aperçu : <span className="break-all font-mono font-semibold text-[var(--foreground)]">{proposedExample}</span></p><Button type="button" className="h-9 text-xs" onClick={reviewChange}>Vérifier la correction<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Button></div>
      </>}
      {validationError ? <p role="alert" className="mt-3 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-3 py-2 text-xs leading-5 text-[var(--danger)]">{validationError}</p> : null}
    </form> : state.success ? <p role="status" className="mt-3 flex items-center gap-1.5 text-xs text-[var(--success)]"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{state.message || "Compteur corrigé."}</p> : null}
  </article>;
}

export function NumberingSettings({ data, saveAction }: { data: NumberingSettingsData; saveAction: SaveAction }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<NumberingGroup | "all">("all");
  const visibleGroups = groups.filter((candidate) => data.counters.some((counter) => counter.group === candidate.key));
  const filteredCounters = useMemo(() => data.counters.filter((counter) => (group === "all" || counter.group === group) && `${counter.label} ${counter.description ?? ""} ${counter.prefix}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))), [data.counters, group, query]);
  const canEdit = data.canEdit && data.migrationReady;

  if (!data.canEdit && data.counters.length === 0) {
    return <Card className="mt-6"><CardContent className="flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--muted)]"><LockKeyhole className="h-4 w-4" aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">Accès réservé à l’administration</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{data.error || "Seuls le propriétaire et les administrateurs peuvent consulter et corriger les compteurs de l’entreprise."}</p></div></CardContent></Card>;
  }

  if (data.error && data.counters.length === 0) {
    return <Card className="mt-6"><CardContent><h2 className="text-sm font-semibold">Les compteurs ne sont pas encore disponibles</h2><p role="status" className="mt-2 text-sm leading-6 text-[var(--muted)]">{data.error}</p><Button type="button" variant="secondary" className="mt-4" onClick={() => router.refresh()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Actualiser les compteurs</Button></CardContent></Card>;
  }

  return <div className="mt-6 space-y-5">
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"><Info className="h-4 w-4" aria-hidden="true" /></span>
      <div><p className="text-sm font-medium">Reprenez votre numérotation en toute simplicité</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Indiquez le prochain numéro à utiliser pour chaque type de document. Les numéros déjà attribués sont conservés et les doublons sont bloqués.</p></div>
    </div>

    <form method="get" className="flex flex-col items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:items-end">
      <div className="w-full sm:w-52"><label htmlFor="numbering-period" className="mb-1.5 block text-xs font-medium">Période des documents</label><Input key={data.selectedPeriod} id="numbering-period" type="month" name="period" min="1900-01" max="2199-12" defaultValue={data.selectedPeriod} required /></div>
      <Button type="submit" variant="secondary">Afficher la période</Button>
      {visibleGroups.some((candidate) => candidate.key === "accounting") ? <p className="text-xs leading-5 text-[var(--muted)] sm:ml-auto sm:max-w-60">Les documents suivent leur série mensuelle ; les journaux, leur série annuelle.</p> : null}
    </form>

    {!data.canEdit ? <p className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs leading-5 text-[var(--muted)]"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Vous consultez les compteurs de l’entreprise. Seuls le propriétaire et les administrateurs peuvent les corriger.</p> : !data.migrationReady ? <p role="status" className="flex items-start gap-2 rounded-xl border border-[var(--warning)]/20 bg-[var(--warning-soft)] px-4 py-3 text-xs leading-5"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />La correction des compteurs doit être activée par l’équipe Felexia. Les numéros sont consultables ci-dessous.</p> : null}

    {data.error ? <Card><CardContent><p role="alert" className="text-sm text-[var(--danger)]">{data.error}</p><Button type="button" variant="secondary" className="mt-4" onClick={() => router.refresh()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Actualiser les compteurs</Button></CardContent></Card> : null}

    {data.counters.length > 0 ? <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" /><Input aria-label="Rechercher un type de document" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un type de document…" /></div>
        <Button type="button" variant="secondary" onClick={() => router.refresh()} aria-label="Actualiser les compteurs"><RefreshCw className="h-4 w-4" aria-hidden="true" /><span>Actualiser</span></Button>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Filtrer les types de document">
        {[{ key: "all", label: "Tous les compteurs" }, ...visibleGroups].map((candidate) => <button key={candidate.key} type="button" aria-pressed={group === candidate.key} onClick={() => setGroup(candidate.key as NumberingGroup | "all")} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${group === candidate.key ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"}`}>{candidate.label}</button>)}
      </div>
      {filteredCounters.length > 0 ? visibleGroups.map(({ key, label, description, icon: Icon }) => {
        const counters = filteredCounters.filter((counter) => counter.group === key);
        return counters.length > 0 ? <Card key={key}>
          <CardHeader className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--muted-strong)]"><Icon className="h-4 w-4" aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">{label}</h2><p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{description}</p></div></div><Badge>{counters.length}</Badge></CardHeader>
          <div className="divide-y divide-[var(--border-subtle)]">{counters.map((counter) => <CounterRow key={`${counter.key}:${counter.revision}`} counter={counter} canEdit={canEdit} saveAction={saveAction} selectedPeriod={data.selectedPeriod} />)}</div>
        </Card> : null;
      }) : <EmptyState title="Aucun compteur ne correspond" description="Essayez un autre nom ou affichez tous les types de documents." icon={<Search className="h-5 w-5" />} action={<Button type="button" variant="secondary" onClick={() => { setQuery(""); setGroup("all"); }}>Réinitialiser les filtres</Button>} />}
    </> : !data.error ? <EmptyState title="Les compteurs apparaîtront ici" description="Vos séries de numérotation seront proposées pour les documents de votre entreprise." icon={<Hash className="h-5 w-5" />} /> : null}
    <p className="flex items-center gap-2 text-xs leading-5 text-[var(--muted)]"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />Chaque correction est vérifiée et rattachée à l’administrateur qui l’effectue.</p>
  </div>;
}
