import { GuidePage } from "@/components/marketing/GuidePage";
import { getGuide } from "@/lib/content/guides";
import { createPublicMetadata } from "@/lib/seo";

const guide = getGuide("/declaration-tva-maroc");

export const metadata = createPublicMetadata({
  title: guide.title,
  description: guide.description,
  path: guide.path,
});

export default function DeclarationTvaMarocPage() {
  return <GuidePage guide={guide} />;
}
