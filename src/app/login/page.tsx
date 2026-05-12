import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getActiveWorkspace } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const supabaseProjectRef = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
    : null;
  const authCookieName = supabaseProjectRef ? `sb-${supabaseProjectRef}-auth-token` : null;
  const hasAuthCookie = authCookieName
    ? cookieStore.getAll().some((c) => c.name.startsWith(authCookieName))
    : false;

  if (hasAuthCookie) {
    const workspace = await getActiveWorkspace();
    if (workspace) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
              <Logo size={36} />
            </span>
            <p className="text-sm font-semibold text-[var(--secondary)]">Felexia facilite ta gestion</p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Connexion</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Accedez a votre espace ERP securise.</p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
