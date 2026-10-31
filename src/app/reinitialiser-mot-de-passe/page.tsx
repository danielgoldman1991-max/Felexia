import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { createClient } from "@/lib/supabase/server";
import { canCompletePasswordRecovery } from "@/lib/auth/recovery-session";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ready = user && await canCompletePasswordRecovery(user.id);
  return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-12"><section className="w-full max-w-md space-y-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-sm">
    <Link href="/" aria-label="Felexia Pro — Accueil"><BrandLogo variant="horizontal" size="sm" /></Link>
    <div><h1 className="text-2xl font-semibold">Nouveau mot de passe</h1><p className="mt-2 text-sm text-[var(--muted)]">Définissez le mot de passe de votre compte.</p></div>
    {ready ? <PasswordRecoveryForm complete /> : <div className="space-y-4"><p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Ce lien est invalide, expiré ou a été ouvert dans un autre navigateur. Demandez un nouveau lien puis ouvrez-le dans le navigateur utilisé pour la demande.</p><Link href="/mot-de-passe-oublie" className="block font-medium text-[var(--primary)]">Demander un nouveau lien</Link></div>}
  </section></main>;
}
