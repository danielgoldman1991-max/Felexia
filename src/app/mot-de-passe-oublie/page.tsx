import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export default function ForgotPasswordPage() {
  return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-12"><section className="w-full max-w-md space-y-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-sm">
    <Link href="/" aria-label="Felexia Pro — Accueil"><BrandLogo variant="horizontal" size="sm" /></Link>
    <div><h1 className="text-2xl font-semibold">Mot de passe oublié</h1><p className="mt-2 text-sm text-[var(--muted)]">Recevez un lien sécurisé pour retrouver l’accès à votre espace Felexia Pro.</p></div>
    <PasswordRecoveryForm />
  </section></main>;
}
