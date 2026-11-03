export const DGI_FLOW_STEPS = [
  { code: "draft", label: "Brouillon commercial" },
  { code: "generated", label: "PDF et XML préparés" },
  { code: "issued", label: "Émis et archivé localement" },
  { code: "transmission", label: "Transmission DGI" },
] as const;

/** La transmission officielle reste fermée tant que la connexion et la signature ne sont pas configurées. */
export function dgiFlowState(input: { hasPdf: boolean; hasXml: boolean; issued: boolean; transmissionConfigured: boolean }) {
  const reached = input.issued ? "issued" : input.hasPdf && input.hasXml ? "generated" : "draft";
  return {
    reached,
    transmissionAvailable: false,
    reason: input.transmissionConfigured
      ? "La connexion est indiquée, mais Felexia n'envoie encore aucune facture à la DGI."
      : "Connexion DGI et signature qualifiée non configurées. Aucune transmission n'est possible.",
  };
}
