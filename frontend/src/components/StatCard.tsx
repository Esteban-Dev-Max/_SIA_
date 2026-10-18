import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "primary" | "emerald" | "amber" | "violet" | "rose" | "sky";
};

const accentVariants = {
  primary: "bg-gradient-to-br from-primary/10 to-primary/5 text-primary border-primary/10",
  emerald:
    "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 text-emerald-600 border-emerald-500/10",
  amber: "bg-gradient-to-br from-amber-500/10 to-amber-500/5 text-amber-600 border-amber-500/10",
  violet:
    "bg-gradient-to-br from-violet-500/10 to-violet-500/5 text-violet-600 border-violet-500/10",
  rose: "bg-gradient-to-br from-rose-500/10 to-rose-500/5 text-rose-600 border-rose-500/10",
  sky: "bg-gradient-to-br from-sky-500/10 to-sky-500/5 text-sky-600 border-sky-500/10",
};

const gradientAccents = {
  primary: "from-primary to-violet-600",
  emerald: "from-emerald-500 to-teal-600",
  amber: "from-amber-500 to-orange-600",
  violet: "from-violet-500 to-purple-600",
  rose: "from-rose-500 to-pink-600",
  sky: "from-sky-500 to-blue-600",
};

export function StatCard({ label, value, icon: Icon, accent = "primary" }: StatCardProps) {
  return (
    <Card className="group relative overflow-hidden border-border/50 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          "bg-gradient-to-br from-transparent via-transparent to-muted/20",
        )}
      />
      <CardContent className="relative flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
            accentVariants[accent],
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
        </div>
        <div
          className={cn(
            "absolute -bottom-6 -right-6 h-16 w-16 rounded-full opacity-5 transition-all duration-500 group-hover:scale-150 group-hover:opacity-10",
            `bg-gradient-to-br ${gradientAccents[accent]}`,
          )}
        />
      </CardContent>
    </Card>
  );
}
