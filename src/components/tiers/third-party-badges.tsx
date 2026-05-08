import { Badge } from "@/components/ui/badge";
import { typeLabel, type ThirdPartyKind } from "@/lib/third-party-types";

const tones: Record<ThirdPartyKind, "info" | "success" | "warning"> = {
  prospect: "info",
  customer: "success",
  supplier: "warning",
};

export function ThirdPartyBadges({ types }: { types: ThirdPartyKind[] | null | undefined }) {
  if (!types?.length) {
    return <Badge>Non classe</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map((type) => (
        <Badge key={type} tone={tones[type]}>
          {typeLabel(type)}
        </Badge>
      ))}
    </div>
  );
}
