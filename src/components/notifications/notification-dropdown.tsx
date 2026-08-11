"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, CheckCheck, ExternalLink, Info, AlertTriangle, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrialNotification } from "@/lib/notifications/trial";

const severityConfig: Record<string, { icon: typeof Info; classes: string; dot: string }> = {
  info:    { icon: Info,          classes: "bg-[var(--info-soft)] text-[var(--info)]", dot: "bg-[var(--info)]" },
  warning: { icon: AlertTriangle, classes: "bg-[var(--warning-soft)] text-[var(--warning)]", dot: "bg-[var(--warning)]" },
  urgent:  { icon: AlertCircle,   classes: "bg-[var(--warning-soft)] text-[var(--warning)]", dot: "bg-[var(--warning)]" },
  error:   { icon: XCircle,       classes: "bg-[var(--danger-soft)] text-[var(--danger)]", dot: "bg-[var(--danger)]" },
  success: { icon: CheckCheck,    classes: "bg-[var(--success-soft)] text-[var(--success)]", dot: "bg-[var(--success)]" },
};

export function NotificationDropdown({ align = "right" }: { align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<TrialNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Impossible de charger les notifications.");
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount((data.notifications ?? []).filter((n: TrialNotification) => !n.is_read).length);
    } catch {
      setLoadError("Impossible de charger les notifications. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      void fetchNotifications();
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAsRead(id: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllAsRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  const hasUrgent = notifications.some((n) => !n.is_read && (n.severity === "urgent" || n.severity === "error"));

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => handleOpenChange(!open)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-[var(--card)]",
              hasUrgent ? "bg-[var(--danger)]" : "bg-[var(--muted)]",
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={cn("absolute top-full z-50 mt-2 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)] shadow-[var(--shadow-lg)]", align === "right" ? "right-0" : "left-0")}>
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
            <h3 className="text-sm font-semibold text-[var(--popover-foreground)]">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-medium text-[var(--primary)] transition hover:text-[var(--primary)] hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" />
              </div>
            ) : loadError ? (
              <div className="px-5 py-8 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-[var(--danger)]" />
                <p className="mt-3 text-sm text-[var(--danger)]">{loadError}</p>
                <button type="button" onClick={() => void fetchNotifications()} className="mt-3 text-sm font-semibold text-[var(--primary)] hover:underline">Réessayer</button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="mx-auto h-8 w-8 text-[var(--muted)]" />
                <p className="mt-3 text-sm text-[var(--muted)]">Aucune notification pour le moment.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {notifications.map((n) => {
                  const sev = severityConfig[n.severity] || severityConfig.info;
                  const SevIcon = sev.icon;
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "group relative px-5 py-4 transition hover:bg-[var(--surface-soft)]",
                        !n.is_read && "bg-[var(--info-soft)]/60",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", sev.classes)}>
                          <SevIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm font-semibold", !n.is_read ? "text-[var(--foreground)]" : "text-[var(--muted)]")}>
                              {n.title}
                            </p>
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", sev.dot)} />
                          </div>
                          <p className="mt-0.5 text-sm text-[var(--muted)]">{n.message}</p>
                          <div className="mt-2 flex items-center gap-3">
                            {n.action_url && (
                              <a
                                href={n.action_url}
                                onClick={() => {
                                  if (!n.is_read) markAsRead(n.id);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] transition hover:underline"
                              >
                                {n.action_label || "Voir"}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <span className="text-[11px] text-[var(--muted-2)]">
                              {new Date(n.created_at).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                        </div>
                        {!n.is_read && (
                          <button
                            type="button"
                            onClick={() => markAsRead(n.id)}
                            className="shrink-0 rounded-full p-1 text-[var(--muted)] opacity-0 transition hover:text-[var(--foreground)] group-hover:opacity-100"
                            aria-label="Marquer comme lu"
                          >
                            <CheckCheck className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
