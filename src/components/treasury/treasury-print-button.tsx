import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TreasuryPrintButton({ href }: { href: string }) {
  return (
    <Button variant="secondary" asChild><Link href={href}><Printer className="h-4 w-4" /> Aperçu / PDF</Link></Button>
  );
}
