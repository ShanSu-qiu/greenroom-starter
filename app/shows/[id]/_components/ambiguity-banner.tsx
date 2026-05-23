import { AlertTriangle } from "lucide-react";

export default function AmbiguityBanner({
  unresolvedCount,
}: {
  unresolvedCount: number;
}) {
  if (unresolvedCount === 0) return null;

  return (
    <div className="rounded-lg bg-amber-50/50 ring-1 ring-amber-200/60 p-4 flex items-center gap-2.5">
      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
      <span className="text-[13px] text-amber-900">
        {unresolvedCount} unresolved ambiguit
        {unresolvedCount === 1 ? "y" : "ies"} — review before show date
      </span>
    </div>
  );
}
