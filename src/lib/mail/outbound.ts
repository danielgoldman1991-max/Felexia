export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
};

export type OutboundResult = {
  delivered: boolean;
  transport: "unconfigured" | "webhook";
  error?: string;
};

/** Envoi seulement si FELEXIA_OUTBOUND_EMAIL_URL est défini. Aucune clé n'est inventée. */
export async function sendTransactionalEmail(message: OutboundEmail): Promise<OutboundResult> {
  const url = process.env.FELEXIA_OUTBOUND_EMAIL_URL?.trim();
  if (!url) return { delivered: false, transport: "unconfigured" };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!response.ok) return { delivered: false, transport: "webhook", error: `Le service d'envoi a répondu ${response.status}.` };
    return { delivered: true, transport: "webhook" };
  } catch {
    return { delivered: false, transport: "webhook", error: "Le service d'envoi est injoignable." };
  }
}
