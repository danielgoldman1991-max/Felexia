import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterAdminForm } from "@/components/auth/register-admin-form";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

// RULE: This page must NEVER auto-redirect on load.
// Redirects happen ONLY after user actions (loginAction or registerAdminForm).
// Even if a user is already logged in, /login must remain accessible.

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed:
    "La connexion avec Google n'a pas pu aboutir. Réessayez ou utilisez votre email.",
  oauth_callback_failed:
    "La connexion avec Google n'a pas pu aboutir. Réessayez ou utilisez votre email.",
  missing_oauth_code:
    "La connexion avec Google a été interrompue. Réessayez ou utilisez votre email.",
  access_denied:
    "Accès refusé par Google. Vous avez peut-être annulé la connexion.",
  account_conflict:
    "Un compte existe déjà avec cet email. Connectez-vous avec votre email et mot de passe, ou contactez le support.",
  oauth_profile_initialization_failed:
    "Nous n'avons pas pu finaliser votre compte. Réessayez ou utilisez votre email.",
};

function friendlyAuthError(errorCode: string | undefined): string | null {
  if (!errorCode) return null;
  return AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES.google_auth_failed!;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string; error?: string; notice?: string }>;
}) {
  const { mode, next, error: errorCode, notice } = await searchParams;
  const isRegisterMode = mode === "register";
  const isLoginMode = !isRegisterMode;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "";
  const nextQuery = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";
  const authError = friendlyAuthError(errorCode);

  return (
    <main className="flex min-h-screen bg-white">
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-xl">
          <div className="mb-10">
            <Link href="/" aria-label="FelexiaERP - accueil" className="inline-block">
              <BrandLogo variant="horizontal" size="lg" priority />
            </Link>
          </div>

          {isRegisterMode ? (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Créez votre compte administrateur
              </h1>
              <p className="mt-3 text-base text-slate-500">
                Votre email servira de login pour accéder à FelexiaERP.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Connexion
              </h1>
              <p className="mt-3 text-base text-slate-500">
                Accédez à votre espace FelexiaERP.
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
            {notice === "password_updated" ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Votre mot de passe a été modifié. Connectez-vous avec votre nouveau mot de passe.</div> : null}
            {notice === "confirm_email" ? (
              <p role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm leading-6 text-blue-800">
                Consultez votre boîte mail et ouvrez le lien de confirmation pour continuer la création de votre entreprise. Si votre email est déjà confirmé, connectez-vous ci-dessous.
              </p>
            ) : null}
            {authError ? (
              <p
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700"
              >
                {authError}
              </p>
            ) : null}

            <GoogleAuthButton mode={isRegisterMode ? "register" : "login"} next={safeNext} />

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
          <div className="mb-8 flex justify-center">
            <BrandLogo variant="horizontal" size="xl" />
          </div>
          <blockquote className="text-lg font-medium text-slate-700">
            Vos factures de vente et d’achat, leurs règlements et votre trésorerie, dans un espace simple.
          </blockquote>
          <div className="mt-10 flex items-center justify-center gap-8 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Facturation
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Journaux
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Trésorerie
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
