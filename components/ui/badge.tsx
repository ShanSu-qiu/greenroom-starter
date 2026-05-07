import { cn } from "@/lib/utils";

type Status = "booked" | "advanced" | "day_of" | "settled" | "closed";

const styles: Record<Status, string> = {
  booked: "bg-zinc-100 text-zinc-800 ring-zinc-200",
  advanced: "bg-blue-50 text-blue-800 ring-blue-200",
  day_of: "bg-amber-50 text-amber-900 ring-amber-200",
  settled: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  closed: "bg-zinc-50 text-zinc-500 ring-zinc-200",
};

const labels: Record<Status, string> = {
  booked: "Booked",
  advanced: "Advanced",
  day_of: "Day of",
  settled: "Settled",
  closed: "Closed",
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset",
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}

const dealStyles: Record<string, string> = {
  flat: "bg-zinc-50 text-zinc-700 ring-zinc-200",
  percentage_of_gross: "bg-zinc-50 text-zinc-700 ring-zinc-200",
  percentage_of_net: "bg-orange-50 text-orange-800 ring-orange-200",
  vs: "bg-orange-50 text-orange-800 ring-orange-200",
  door: "bg-purple-50 text-purple-800 ring-purple-200",
};

const dealLabels: Record<string, string> = {
  flat: "Flat",
  percentage_of_gross: "% of gross",
  percentage_of_net: "% of net",
  vs: "Vs deal",
  door: "Door deal",
};

export function DealTypeBadge({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset",
        dealStyles[type] ?? "bg-zinc-50 text-zinc-700 ring-zinc-200",
        className,
      )}
    >
      {dealLabels[type] ?? type}
    </span>
  );
}
