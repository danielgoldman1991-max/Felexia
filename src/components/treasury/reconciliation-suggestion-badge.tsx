import { Badge } from "@/components/ui/badge";

export function ReconciliationSuggestionBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge tone="success">Suggestion forte</Badge>;
  if (score >= 60) return <Badge tone="warning">Suggestion moyenne</Badge>;
  return <Badge tone="neutral">A verifier</Badge>;
}
