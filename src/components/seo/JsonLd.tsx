import { serializeJsonLd } from "@/lib/seo";

export function JsonLd({ id, data }: { id: string; data: unknown }) {
  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
