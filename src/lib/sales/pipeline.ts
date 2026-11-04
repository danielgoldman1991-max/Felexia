export const PIPELINE_STAGES = [
  { code: "qualification", label: "Qualification", probability: 0.1 },
  { code: "proposition", label: "Proposition", probability: 0.4 },
  { code: "negociation", label: "Négociation", probability: 0.7 },
  { code: "gagnee", label: "Gagnée", probability: 1 },
  { code: "perdue", label: "Perdue", probability: 0 },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["code"];

export function forecastOpportunities(rows: { stage: PipelineStage; amount: number }[]) {
  const byStage = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.code, { amount: 0, weighted: 0, count: 0 }])) as Record<PipelineStage, { amount: number; weighted: number; count: number }>;
  for (const row of rows) {
    const stage = PIPELINE_STAGES.find((item) => item.code === row.stage);
    if (!stage) continue;
    const amount = Math.max(0, row.amount);
    byStage[row.stage].amount = Math.round((byStage[row.stage].amount + amount) * 100) / 100;
    byStage[row.stage].weighted = Math.round((byStage[row.stage].weighted + amount * stage.probability) * 100) / 100;
    byStage[row.stage].count += 1;
  }
  const weighted = Object.values(byStage).reduce((sum, stage) => sum + stage.weighted, 0);
  return { byStage, weighted: Math.round(weighted * 100) / 100 };
}
