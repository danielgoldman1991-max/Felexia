import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-start justify-center gap-4 px-6">
      <p className="text-sm font-semibold text-[var(--primary)]">404</p>
      <h1 className="text-3xl font-semibold">Cette page est introuvable.</h1>
      <p className="text-sm text-[var(--muted)]">L’adresse n’existe pas ou n’est plus disponible. Vous pouvez revenir à l’accueil.</p>
      <Link href="/" className="rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">Retour à l’accueil</Link>
    </main>
  );
}
