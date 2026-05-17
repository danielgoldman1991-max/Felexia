import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterAdminForm } from "@/components/auth/register-admin-form";

// RULE: This page must NEVER auto-redirect on load.
// Redirects happen ONLY after user actions (loginAction or registerAdminForm).
// Even if a user is already logged in, /login must remain accessible.

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const { mode, next } = await searchParams;
  const isRegisterMode = mode === "register";
  const isLoginMode = !isRegisterMode;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "";
  const nextQuery = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";

  return (
    <main className="flex min-h-screen bg-white">
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-xl">
          <div className="mb-8">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <Logo size={28} />
            </span>
          </div>

          {isRegisterMode ? (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Créez votre compte administrateur
              </h1>
              <p className="mt-3 text-base text-slate-500">
                Votre email servira de login pour accéder à Felexia.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Connexion
              </h1>
              <p className="mt-3 text-base text-slate-500">
                Accédez à votre espace Felexia.
              </p>
            </>
          )}

          <div className="mt-8 flex gap-6 border-b border-slate-200">
            <Link
              href={`/login?mode=register${nextQuery}`}
              className={`pb-3 text-sm font-medium transition ${
                isRegisterMode
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Créer mon compte
            </Link>
            <Link
              href={safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login"}
              className={`pb-3 text-sm font-medium transition ${
                isLoginMode
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Se connecter
            </Link>
          </div>

          <div className="mt-8">
            {isRegisterMode ? <RegisterAdminForm /> : <LoginForm nextPath={safeNext} />}
          </div>

          {isLoginMode && (
            <p className="mt-6 text-center text-sm text-slate-500">
              Pas encore de compte ?{" "}
              <Link href={`/login?mode=register${nextQuery}`} className="font-medium text-blue-600 hover:text-blue-700">
                Créer mon compte
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center lg:bg-slate-50 lg:px-12">
        <div className="max-w-md text-center">
          <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Logo size={48} />
          </div>
          <blockquote className="text-lg font-medium text-slate-700">
            &ldquo;Felexia a transformé notre gestion d&apos;entreprise. Factures, devis, comptabilité — tout est centralisé.&rdquo;
          </blockquote>
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-300" />
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">Karim B.</p>
              <p className="text-xs text-slate-500">CEO, Atlas Distribution</p>
            </div>
          </div>
          <div className="mt-10 flex items-center justify-center gap-8 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Facturation
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Comptabilité
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Stock
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
