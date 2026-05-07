import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, FileWarning } from "lucide-react";
import { getShowById } from "@/lib/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StatusBadge, DealTypeBadge } from "@/components/ui/badge";
import { calculateSettlement } from "@/lib/dealMath";
import { formatMoney, formatShowDateFull } from "@/lib/format";

export default async function SettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const { show, artist, deal, ticketSales, expenses, settlement } = data;

  if (!deal) {
    return (
      <div className="p-8 max-w-3xl">
        <BackLink showId={show.id} />
        <div className="text-sm text-zinc-500">
          No deal entered for this show. Settlement can&apos;t run yet.
        </div>
      </div>
    );
  }

  const calc = calculateSettlement({ deal, ticketSales, expenses });

  return (
    <div className="p-8 max-w-3xl">
      <BackLink showId={show.id} />

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={show.status} />
          <DealTypeBadge type={deal.dealType} />
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Settlement · {artist?.name}
        </h1>
        <div className="text-sm text-zinc-500 mt-1">
          {formatShowDateFull(show.date)}
        </div>
      </div>

      {!calc.supported ? (
        <UnsupportedDeal dealType={calc.dealType} reason={calc.reason} />
      ) : (
        <SupportedSettlement
          calc={calc}
          alreadySettled={Boolean(settlement?.totalToArtist)}
          existingTotal={settlement?.totalToArtist}
        />
      )}

      <div className="mt-6 text-xs text-zinc-400">
        <p>
          The in-app settlement tool was built early in Greenroom&apos;s
          history, when most deals were flat guarantees. Roughly 18% of our
          customer base actively uses it; the other 82% default to
          spreadsheets. The CEO has flagged this as our biggest craft gap.
        </p>
      </div>
    </div>
  );
}

function BackLink({ showId }: { showId: string }) {
  return (
    <Link
      href={`/shows/${showId}`}
      className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to show
    </Link>
  );
}

function UnsupportedDeal({
  dealType,
  reason,
}: {
  dealType: string;
  reason: string;
}) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200 mb-3">
          <FileWarning className="h-5 w-5 text-amber-700" />
        </div>
        <h2 className="text-base font-semibold text-zinc-900 mb-1">
          This deal type isn&apos;t supported in the in-app tool
        </h2>
        <p className="text-sm text-zinc-600 max-w-md mx-auto">{reason}</p>
        <div className="mt-5 inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-50 rounded-md px-3 py-1.5 ring-1 ring-zinc-200">
          <AlertTriangle className="h-3 w-3" />
          Most settlements at The Crescent fall into this bucket.
        </div>
      </CardContent>
    </Card>
  );
}

function SupportedSettlement({
  calc,
  alreadySettled,
  existingTotal,
}: {
  calc: Extract<
    ReturnType<typeof calculateSettlement>,
    { supported: true }
  >;
  alreadySettled: boolean;
  existingTotal?: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Settlement worksheet</CardTitle>
          <CardDescription>{calc.finalFormula}</CardDescription>
        </div>
        {alreadySettled && (
          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded ring-1 ring-emerald-200">
            Signed
          </span>
        )}
      </CardHeader>
      <CardContent className="divide-y divide-zinc-100">
        <Row
          label="Gross box office"
          value={formatMoney(calc.grossBoxOffice)}
        />
        <Row label="Net box office" value={formatMoney(calc.netBoxOffice)} />
        <Row
          label="Total expenses (passed through)"
          value={formatMoney(calc.totalExpenses)}
        />
        <div className="pt-3" />
        {calc.steps.map((step, i) => (
          <Row
            key={i}
            label={step.label}
            value={formatMoney(step.value)}
            note={step.note}
          />
        ))}
        <div className="pt-3" />
        <div className="flex items-baseline justify-between py-3">
          <span className="text-sm font-semibold text-zinc-900">
            Total to artist
          </span>
          <span className="text-2xl font-semibold text-zinc-900 tabular-nums">
            {formatMoney(calc.totalToArtist)}
          </span>
        </div>
        {alreadySettled && existingTotal != null && (
          <div className="text-xs text-zinc-500 pt-2">
            Originally settled at {formatMoney(existingTotal)}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <div>
        <div className="text-sm text-zinc-700">{label}</div>
        {note && <div className="text-xs text-zinc-500 mt-0.5">{note}</div>}
      </div>
      <div className="text-sm text-zinc-900 tabular-nums">{value}</div>
    </div>
  );
}
