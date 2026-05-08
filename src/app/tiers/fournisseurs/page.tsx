import { ThirdPartyListPage } from "@/components/tiers/third-party-list-page";

export default function TiersFournisseursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ThirdPartyListPage searchParams={searchParams} forcedType="supplier" showCounters={false} />;
}
