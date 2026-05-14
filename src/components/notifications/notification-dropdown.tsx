"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, CheckCheck, ExternalLink, Info, AlertTriangle, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrialNotification } from "@/lib/notifications/trial";

const severityConfig: Record<string, { icon: typeof Info; classes: string; dot: string }> = {
  info:    { icon: Info,          classes: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  warning: { icon: AlertTriangle, classes: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-400" },
  urgent:  { icon: AlertCircle,   classes: "bg-orange-50 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  error:   { icon: XCircle,       classes: "bg-red-50 text-red-800 border-red-200", dot: "bg-red-500" },
  success: { icon: CheckCheck,    classes: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
};

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<TrialNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount((data.notifications ?? []).filter((n: TrialNotification) => !n.is_read).length);
    } catch {
      // silent
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
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-900"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white",
              hasUrgent ? "bg-rose-500" : "bg-slate-500",
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 transition"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">Aucune notification pour le moment.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => {
                  const sev = severityConfig[n.severity] || severityConfig.info;
                  const SevIcon = sev.icon;
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "group relative px-5 py-4 transition hover:bg-slate-50",
                        !n.is_read && "bg-blue-50/30",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", sev.classes)}>
                          <SevIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm font-semibold", !n.is_read ? "text-slate-900" : "text-slate-600")}>
                              {n.title}
                            </p>
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", sev.dot)} />
                          </div>
                          <p className="mt-0.5 text-sm text-slate-500">{n.message}</p>
                          <div className="mt-2 flex items-center gap-3">
                            {n.action_url && (
                              <a
                                href={n.action_url}
                                onClick={() => {
                                  if (!n.is_read) markAsRead(n.id);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                              >
                                {n.action_label || "Voir"}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <span className="text-[11px] text-slate-400">
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
                            className="shrink-0 rounded-full p-1 text-slate-300 opacity-0 transition hover:text-slate-500 group-hover:opacity-100"
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
