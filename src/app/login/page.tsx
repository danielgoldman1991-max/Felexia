import { redirect } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getActiveWorkspace } from "@/lib/auth";

export default async function LoginPage() {
  const workspace = await getActiveWorkspace();

  if (workspace) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
              <Image src="/felexia-conseils-logo.jpg" alt="Logo Felexia Conseils" width={44} height={44} className="h-11 w-11 object-contain" />
            </span>
            <p className="text-sm font-semibold text-[var(--secondary)]">Felexia facilite ta gestion</p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Connexion</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Accedez a votre espace ERP securise.</p>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
            Utilisez un compte Supabase Auth rattache a une organisation active.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
