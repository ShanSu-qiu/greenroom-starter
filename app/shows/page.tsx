import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAllShows } from "@/lib/queries";
import { StatusBadge, DealTypeBadge } from "@/components/ui/badge";
import { formatShowDate, formatMoneyCompact, relativeShowDate } from "@/lib/format";

export default async function ShowsPage() {
  const rows = await getAllShows();

  // Group by upcoming vs past for the simplest possible view.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = rows.filter((r) => new Date(r.show.date) >= today);
  const past = rows.filter((r) => new Date(r.show.date) < today);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Shows</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Upcoming and recent shows at The Crescent.
        </p>
      </div>

      <Section title="Upcoming" rows={upcoming} emptyText="No shows on the books." />
      <div className="h-8" />
      <Section title="Recent" rows={past} emptyText="No shows yet." />
    </div>
  );
}

function Section({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof getAllShows>>;
  emptyText: string;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        {title}
      </h2>
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-sm text-zinc-500 text-center">
            {emptyText}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map(({ show, artist, deal, settlement }) => (
              <li key={show.id}>
                <Link
                  href={`/shows/${show.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors"
                >
                  <div className="w-24 shrink-0">
                    <div className="text-sm font-medium text-zinc-900">
                      {formatShowDate(show.date)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {relativeShowDate(show.date)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900">
                      {artist?.name ?? "—"}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                      {deal && <DealTypeBadge type={deal.dealType} />}
                      {deal?.guaranteeAmount != null && (
                        <span>
                          guarantee {formatMoneyCompact(deal.guaranteeAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                  {settlement?.totalToArtist != null && (
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Settled</div>
                      <div className="text-sm font-medium text-zinc-900">
                        {formatMoneyCompact(settlement.totalToArtist)}
                      </div>
                    </div>
                  )}
                  <StatusBadge status={show.status} />
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
