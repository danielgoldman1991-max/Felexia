import { ThirdPartyListPage } from "@/components/tiers/third-party-list-page";

export default function TiersClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ThirdPartyListPage searchParams={searchParams} forcedType="customer" showCounters={false} />;
}
