import { AuditLogScreen } from "@/components/settings/audit-log-screen";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; user?: string; action?: string; table?: string }> }) {
  const filters = await searchParams;
  const exportHref = `/outils/audit-log/export?${new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])))}`;
  return <AuditLogScreen filters={filters} exportHref={exportHref} />;
}
