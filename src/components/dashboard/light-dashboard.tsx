import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, FilePlus2, Landmark, Receipt, ShoppingCart, WalletCards } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { TrialStartedBanner } from "@/components/dashboard/trial-started-banner";
import { requireActiveWorkspace } from "@/lib/auth";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { getLightDashboardData } from "@/lib/dashboard-data";
import { getOnboardingChecklist } from "@/lib/onboarding";

const money = (value: number, currency = "MAD") => `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`;

export async function LightDashboard({ searchParams }: {
  searchParams?: Promise<{ trial_started?: string | string[]; setup_notice?: string | string[] }>;
}) {
  const workspace = await requireActiveWorkspace();
  const [data, checklist, params] = await Promise.all([
    getLightDashboardData(), getOnboardingChecklist(workspace.organization.id), searchParams,
  ]);
  const readOnly = isReadOnlyRole(workspace.role);
  const operator = isOperatorRole(workspace.role);
  const name = workspace.profile?.full_name?.trim().split(/\s+/)[0];
  const trialStarted = Array.isArray(params?.trial_started) ? params.trial_started[0] : params?.trial_started;
  const setupNotice = Array.isArray(params?.setup_notice) ? params.setup_notice[0] : params?.setup_notice;
  const actions = readOnly ? [
    { label: "Factures de vente", description: "Consulter les factures clients", href: "/facturation/factures", icon: Receipt, primary: true },
    { label: "Factures d’achat", description: "Consulter les factures fournisseurs", href: "/achats/factures", icon: ShoppingCart, primary: false },
    { label: "Trésorerie", description: "Consulter les comptes et mouvements", href: "/tresorerie", icon: Landmark, primary: false },
    { label: "Journaux", description: "Consulter les écritures comptables", href: "/comptabilite/journaux", icon: BookOpen, primary: false },
  ] : [
    { label: "Facture de vente", description: "Facturer un client", href: "/facturation/factures/new", icon: FilePlus2, primary: true },
    { label: "Facture d’achat", description: "Enregistrer une facture fournisseur", href: "/achats/factures/new", icon: ShoppingCart, primary: false },
    { label: "Règlement client", description: "Enregistrer un encaissement", href: "/facturation/paiements/new", icon: ArrowDownLeft, primary: false },
    { label: "Règlement fournisseur", description: "Enregistrer un paiement", href: "/achats/paiements/new", icon: ArrowUpRight, primary: false },
  ];
  const metrics = [
    { label: "À encaisser", value: data?.receivable, caption: "Factures clients restant à régler", href: "/facturation/factures", icon: ArrowDownLeft },
    { label: "À payer", value: data?.payable, caption: "Factures fournisseurs restant à régler", href: "/achats/factures", icon: ArrowUpRight },
    { label: "Trésorerie disponible", value: data?.cash, caption: "Solde des comptes et caisses actifs", href: "/tresorerie/comptes", icon: Landmark },
    { label: "Ventes du mois TTC", value: data?.monthlySales, caption: "Factures de vente validées ce mois-ci", href: "/facturation/factures", icon: Receipt },
  ];

  return (
    <ModulePage>
      <div className="w-full space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">{workspace.organization.name}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[var(--foreground)] md:text-[1.75rem]">Bonjour{name ? ` ${name}` : ""}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Vos factures, vos règlements et votre trésorerie, simplement.</p>
        </header>

        {!readOnly && !operator && (trialStarted === "1" || workspace.subscription?.status === "trialing") ? <TrialStartedBanner forceOpen={trialStarted === "1"} planCode={workspace.subscription?.planCode} /> : null}

        {!readOnly && !operator && setupNotice === "defaults_incomplete" ? (
          <p role="status" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-6">
            Votre entreprise est créée. Certains réglages de démarrage restent à finaliser. <Link href="/comptabilite/journaux" className="font-semibold text-[var(--primary)] underline">Ouvrez vos journaux pour réessayer</Link>. Si le problème persiste, <Link href="/parametres/modules" className="font-semibold text-[var(--primary)] underline">contactez notre équipe</Link> avant d’inviter vos collaborateurs.
          </p>
        ) : null}

        <section aria-labelledby="actions-title">
          <h2 id="actions-title" className="mb-3 text-base font-semibold text-[var(--foreground)]">{readOnly ? "Que souhaitez-vous consulter ?" : "Que souhaitez-vous faire ?"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actions.map(({ label, description, href, icon: Icon, primary }) => (
              <Link key={href} href={href} className={`group rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${primary ? "border-[var(--primary)] bg-[var(--primary)] !text-white hover:bg-[color-mix(in_srgb,var(--primary)_90%,black)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--primary)]"}`}>
                <span className="flex items-center justify-between gap-3"><span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${primary ? "bg-white/15" : "bg-[var(--primary-soft)] text-[var(--primary)]"}`}><Icon className={`h-5 w-5 ${primary ? "!text-white" : ""}`} /></span><ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${primary ? "!text-white opacity-70" : "text-[var(--muted)]"}`} aria-hidden="true" /></span>
                <span className={`mt-4 block text-sm font-semibold ${primary ? "!text-white" : ""}`}>{label}</span>
                <span className={`mt-1 block text-xs leading-5 ${primary ? "!text-white opacity-90" : "text-[var(--muted)]"}`}>{description}</span>
              </Link>
            ))}
          </div>
        </section>

        {!readOnly && !operator && !checklist.isCompleted ? <Link href="/bienvenue" className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--primary)]">
          <span className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--primary)]" /><span><span className="block text-sm font-semibold">Vos premiers pas</span><span className="mt-1 block text-xs text-[var(--muted)]">{checklist.completedCount}/{checklist.totalCount} étapes réalisées. Configurez votre entreprise et créez votre première facture.</span></span></span>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]">Continuer<ArrowRight className="h-4 w-4" /></span>
        </Link> : null}

        <section aria-labelledby="overview-title">
          <h2 id="overview-title" className="mb-3 text-base font-semibold">Votre activité en un regard</h2>
          {!data ? <p role="status" className="mb-3 rounded-xl bg-[var(--warning-soft)] p-3 text-sm">Les indicateurs sont momentanément indisponibles. Vous pouvez continuer à consulter vos factures.</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, caption, href, icon: Icon }) => <Link key={label} href={href} className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--primary)]">
              <div className="flex items-center justify-between gap-2"><p className="text-sm text-[var(--muted)]">{label}</p><Icon className="h-4 w-4 text-[var(--primary)]" /></div>
              <p className="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums">{value === undefined ? "—" : money(value)}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{caption}</p>
            </Link>)}
          </div>
        </section>

        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]" aria-labelledby="recent-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4"><h2 id="recent-title" className="text-base font-semibold">Dernières factures</h2><Link href="/facturation/factures" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:underline">Voir les ventes<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
          {data?.recentInvoices.length ? <div className="divide-y divide-[var(--border)]">{data.recentInvoices.map((invoice) => <Link key={`${invoice.type}-${invoice.id}`} href={invoice.href} className="flex items-center gap-3 px-5 py-4 transition hover:bg-[var(--surface-soft)]">
            <Receipt className="h-5 w-5 shrink-0 text-[var(--primary)]" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{invoice.number}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{invoice.type === "sale" ? "Vente" : "Achat"} · {invoice.status === "draft" ? "Brouillon" : "Validée"}</span></span><span className="shrink-0 text-sm font-semibold">{money(invoice.total, invoice.currency)}</span><ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          </Link>)}</div> : <div className="px-5 py-8 text-center"><span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Receipt className="h-5 w-5" aria-hidden="true" /></span><p className="text-sm font-medium">{data ? "Aucune facture pour le moment" : "Vos factures restent accessibles"}</p><p className="mt-1 text-sm text-[var(--muted)]">{data ? "Vos dernières ventes et vos derniers achats apparaîtront ici." : "Consultez vos factures depuis Ventes ou Achats."}</p><Link href={readOnly ? "/facturation/factures" : "/facturation/factures/new"} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline">{readOnly ? "Consulter les factures de vente" : "Créer une facture de vente"}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/tresorerie" className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 text-sm font-medium"><WalletCards className="h-5 w-5 text-[var(--primary)]" />Consulter ma trésorerie<ArrowRight className="ml-auto h-4 w-4" /></Link>
          <Link href="/comptabilite/journaux" className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 text-sm font-medium"><BookOpen className="h-5 w-5 text-[var(--primary)]" />Consulter mes journaux<ArrowRight className="ml-auto h-4 w-4" /></Link>
        </div>
      </div>
    </ModulePage>
  );
}
