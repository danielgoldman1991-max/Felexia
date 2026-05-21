import { createClient } from "@/lib/supabase/server";

export type TrialNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  action_label: string | null;
  action_url: string | null;
  severity: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * Build the trial reminder payload based on status and days remaining.
 * Returns null if no notification should be generated.
 */
export function buildTrialNotification(
  status: string,
  trialEnd: string | null,
  daysLeft: number,
): { type: string; title: string; message: string; action_label: string; action_url: string; severity: string; metadata: Record<string, unknown> } | null {
  const today = new Date().toISOString().slice(0, 10);

  if (status === "active") {
    return null;
  }

  if (status === "trialing") {
    if (daysLeft <= 0) {
      return {
        type: "trial_expired",
        title: "Essai Business terminé",
        message: "Votre essai Business spécial lancement est terminé. Activez votre abonnement pour continuer à utiliser Felexia.",
        action_label: "Activer mon abonnement",
        action_url: "/parametres/abonnement",
        severity: "error",
        metadata: { kind: "trial_reminder", days_left: 0, date: today },
      };
    }
    if (daysLeft <= 3) {
      return {
        type: "trial_ending_soon",
        title: "Essai Business - Attention",
        message: `Attention : votre essai Business spécial lancement se termine dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}. Finalisez votre paiement en ligne pour éviter la suspension de votre accès.`,
        action_label: "Payer maintenant",
        action_url: "/parametres/abonnement",
        severity: "urgent",
        metadata: { kind: "trial_reminder", days_left: daysLeft, date: today },
      };
    }
    if (daysLeft <= 7) {
      return {
        type: "trial_ending",
        title: "Essai Business",
        message: `Votre essai Business spécial lancement se termine dans ${daysLeft} jours. Activez votre abonnement pour continuer à utiliser Felexia sans interruption.`,
        action_label: "Payer maintenant",
        action_url: "/parametres/abonnement",
        severity: "warning",
        metadata: { kind: "trial_reminder", days_left: daysLeft, date: today },
      };
    }
    return {
      type: "trial_active",
      title: "Essai Business spécial lancement",
      message: `Votre essai Business spécial lancement Felexia est actif. Il vous reste ${daysLeft} jours avant la fin de votre période d'essai.`,
      action_label: "Voir mon abonnement",
      action_url: "/parametres/abonnement",
      severity: "info",
      metadata: { kind: "trial_reminder", days_left: daysLeft, date: today },
    };
  }

  if (["canceled", "past_due"].includes(status)) {
    return {
      type: "subscription_inactive",
      title: "Abonnement",
      message: "Votre abonnement nécessite une action. Finalisez votre paiement pour continuer à utiliser Felexia.",
      action_label: "Payer maintenant",
      action_url: "/parametres/abonnement",
      severity: "urgent",
      metadata: { kind: "trial_reminder", days_left: 0, date: today },
    };
  }

  return null;
}

/**
 * Generate or update trial reminder notifications for a given organization.
 * Deduplicates by (organization_id, kind, date) — only one notification per day.
 */
export async function generateTrialNotificationForOrg(
  organizationId: string,
): Promise<void> {
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("organization_subscriptions")
    .select("status, trial_end")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  if (!sub) return;

  const trialEnd = sub.trial_end as string | null;
  const daysLeft = trialEnd
    ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const notification = buildTrialNotification(sub.status as string, trialEnd, daysLeft);
  if (!notification) return;

  const today = new Date().toISOString().slice(0, 10);

  // Dedup: check if a notification for same org+kind+date already exists
  const { data: existing } = await supabase
    .from("app_notifications")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("type", notification.type)
    .gte("created_at", `${today}T00:00:00Z`)
    .lt("created_at", `${today}T23:59:59Z`)
    .limit(1);

  if (existing && existing.length > 0) return;

  await supabase.from("app_notifications").insert({
    organization_id: organizationId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    action_label: notification.action_label,
    action_url: notification.action_url,
    severity: notification.severity,
    metadata: notification.metadata,
  });
}
