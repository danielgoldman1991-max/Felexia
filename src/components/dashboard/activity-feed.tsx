import { CheckCircle2, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

type Activity = {
  title: string;
  time: string;
  tone: string;
};

export function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-950">Dernieres activites</h2>
        <Clock3 className="h-4 w-4 text-slate-400" />
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={`${item.title}-${item.time}`} className="flex gap-3">
            <span className={cn("mt-0.5 flex h-8 w-8 items-center justify-center rounded-full", item.tone === "success" ? "bg-green-50 text-green-600" : item.tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600")}>
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-500">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
