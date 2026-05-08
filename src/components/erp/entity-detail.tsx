import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function EntityDetail({ title, id }: { title: string; id: string }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">{title}</h2>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="text-[var(--muted)]">Identifiant</p>
          <p className="font-mono">{id}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Verrouillage</p>
          <p>Les documents valides seront non modifiables cote metier.</p>
        </div>
      </CardContent>
    </Card>
  );
}
