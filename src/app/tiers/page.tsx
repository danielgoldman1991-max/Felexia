import { ThirdPartyListPage } from "@/components/tiers/third-party-list-page";

export default function TiersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ThirdPartyListPage searchParams={searchParams} showCounters={true} />;
}
