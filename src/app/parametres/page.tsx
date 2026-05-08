import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function ParametresPage() {
  return (
    <ModulePage>
      <PageHeader title="Parametres societe" description="Base legale marocaine et preferences de facturation." />
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Felexia Demo</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Input defaultValue="Felexia Demo SARL" aria-label="Raison sociale" />
          <Input defaultValue="Casablanca" aria-label="Ville" />
          <Input defaultValue="001234567000045" aria-label="ICE" />
          <Input defaultValue="48591230" aria-label="IF" />
          <Input defaultValue="RC 129384 Casablanca" aria-label="RC" />
          <Select defaultValue="MAD" aria-label="Devise">
            <option value="MAD">MAD</option>
          </Select>
        </CardContent>
      </Card>
    </ModulePage>
  );
}
