import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function DocumentForm({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">{title}</h2>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2">
          <Input placeholder="Numero automatique" disabled />
          <Input type="date" defaultValue="2026-05-08" />
          <Select defaultValue="">
            <option value="" disabled>Selectionner un tiers</option>
            <option>Atlas Market SARL</option>
            <option>Nova Industries Maroc</option>
          </Select>
          <Select defaultValue="draft">
            <option value="draft">Brouillon</option>
            <option value="sent">Envoye</option>
            <option value="confirmed">Confirme</option>
          </Select>
          <Textarea className="md:col-span-2" placeholder="Notes internes" />
          <div className="md:col-span-2">
            <Button type="button">Enregistrer le brouillon</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
