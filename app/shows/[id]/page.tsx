import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { getShowById } from "@/lib/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StatusBadge, DealTypeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatMoney,
  formatMoneyCompact,
  formatShowDateFull,
  relativeShowDate,
} from "@/lib/format";

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const { show, artist, agent, agency, deal, settlement, ticketSales, expenses } =
    data;

  const grossSoFar = ticketSales.reduce((sum, t) => sum + t.gross, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/shows"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to shows
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={show.status} />
            {deal && <DealTypeBadge type={deal.dealType} />}
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {artist?.name ?? "—"}
          </h1>
          <div className="text-sm text-zinc-500 mt-1">
            {formatShowDateFull(show.date)} ({relativeShowDate(show.date)}) ·
            doors {show.doorsTime} · set {show.setTime}
          </div>
        </div>
        <Link href={`/shows/${show.id}/settle`}>
          <Button>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {settlement ? "View settlement" : "Settle"}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Deal */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Deal terms</CardTitle>
              <CardDescription>
                What was negotiated. Mariana enters this from the email thread
                with the agent.
              </CardDescription>
            </div>
            {deal && <DealTypeBadge type={deal.dealType} />}
          </CardHeader>
          <CardContent className="space-y-4">
            {deal ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Field
                    label="Guarantee"
                    value={
                      deal.guaranteeAmount != null
                        ? formatMoney(deal.guaranteeAmount)
                        : "—"
                    }
                  />
                  <Field
                    label="Percentage"
                    value={
                      deal.percentage != null
                        ? `${(deal.percentage * 100).toFixed(0)}% of ${deal.percentageBasis ?? "—"}`
                        : "—"
                    }
                  />
                  <Field
                    label="Expense cap"
                    value={
                      deal.expenseCap != null
                        ? formatMoney(deal.expenseCap)
                        : "—"
                    }
                  />
                  <Field
                    label="Hospitality cap"
                    value={
                      deal.hospitalityCap != null
                        ? formatMoney(deal.hospitalityCap)
                        : "—"
                    }
                  />
                </div>
                {deal.dealNotesFreetext && (
                  <div>
                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                      Deal notes (free text)
                    </div>
                    <div className="text-sm text-zinc-700 bg-zinc-50 rounded p-3 border border-zinc-200 whitespace-pre-wrap">
                      {deal.dealNotesFreetext}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-zinc-500">No deal entered yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Artist & agent */}
        <Card>
          <CardHeader>
            <CardTitle>Artist & agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Artist" value={artist?.name ?? "—"} />
            <Field
              label="Genre"
              value={artist?.genre ?? "—"}
              className="capitalize"
            />
            <Field
              label="Prior shows here"
              value={String(artist?.priorShowCount ?? 0)}
            />
            <Field
              label="Agent"
              value={
                agent
                  ? `${agent.name}${agency ? ` (${agency.name})` : ""}`
                  : "—"
              }
            />
            {agent?.preferencesNotes && (
              <div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                  Agent notes
                </div>
                <div className="text-sm text-zinc-700 bg-amber-50 rounded p-3 border border-amber-200">
                  {agent.preferencesNotes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket sales */}
        <Card>
          <CardHeader>
            <CardTitle>Ticket sales</CardTitle>
            <CardDescription>From integrated POS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-zinc-500">Gross</span>
              <span className="text-2xl font-semibold text-zinc-900">
                {formatMoneyCompact(grossSoFar)}
              </span>
            </div>
            {ticketSales.length === 0 ? (
              <div className="text-xs text-zinc-500">No sales yet.</div>
            ) : (
              <div className="text-xs text-zinc-500">
                {ticketSales.length} sale event
                {ticketSales.length === 1 ? "" : "s"} ·{" "}
                {formatMoney(ticketSales.reduce((s, t) => s + t.fees, 0))} in
                fees
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>
              Entered during the week, often incompletely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-sm text-zinc-500">
                No expenses entered yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-100">
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium">Description</th>
                    <th className="py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 capitalize">{e.category}</td>
                      <td className="py-2 text-zinc-500">
                        {e.description ?? "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatMoney(e.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="py-2.5" colSpan={2}>
                      Total
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatMoney(totalExpenses)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className={`text-sm text-zinc-900 ${className ?? ""}`}>{value}</div>
    </div>
  );
}
