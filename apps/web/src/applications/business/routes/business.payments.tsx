import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Search, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody, Card, Button } from "@grovyn/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@grovyn/ui/components/dialog";
import { ConfirmDialog } from "@/applications/business/components/confirm-dialog";
import { IconButton } from "@/applications/business/components/icon-button";
import { money } from "@/applications/business/lib/business-format";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import { useClients } from "@/applications/business/lib/business-clients";
import { useInvoices } from "@/applications/business/lib/business-invoices";
import {
  usePayments,
  usePaymentMutations,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type Payment,
  type PaymentMethod,
} from "@/applications/business/lib/business-payments";


const inputCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-ring";
const labelCls = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
const PAYABLE = new Set(["ISSUED", "SENT", "PARTIALLY_PAID"]);

export function PaymentsPage() {
  const navigate = useNavigate();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate({ to: "/", replace: true });
    else if (!appsLoading && !available) navigate({ to: "/", replace: true });
  }, [appsLoading, available, navigate]);

  const enabled = flags.platformShell && available;
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [clientId, setClientId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [recording, setRecording] = useState(false);
  const [toDelete, setToDelete] = useState<Payment | null>(null);

  const { data: clientsPage } = useClients({ limit: 100 }, enabled);
  const { data, isLoading, isError, isFetching } = usePayments(
    {
      page,
      limit: 20,
      search,
      method,
      clientId,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sort: "paymentDate",
      order: "desc",
    },
    enabled,
  );
  const { remove } = usePaymentMutations();

  if (!enabled || appsLoading || !available) return null;

  const payments = data?.data ?? [];

  const runDelete = () => {
    if (!toDelete) return;
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success("Payment removed");
        setToDelete(null);
      },
      onError: () => toast.error("Couldn't remove payment"),
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="Payments"
        description="Business Operations"
        actions={
          canEdit ? (
            <Button onClick={() => setRecording(true)}>
              <Plus className="h-4 w-4" /> Record payment
            </Button>
          ) : undefined
        }
      />
      <PageBody>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search reference or invoice…"
              className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-[13px] outline-none focus:border-ring"
            />
          </div>
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as PaymentMethod | "");
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]"
          >
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]"
          >
            <option value="">All clients</option>
            {clientsPage?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2 py-2 text-[13px]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2 py-2 text-[13px]"
          />
        </div>

        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">
              Couldn't load payments.
            </div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[14px] font-medium">No payments yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Record a payment against an issued invoice.
              </p>
              {canEdit ? (
                <Button className="mt-4" onClick={() => setRecording(true)}>
                  <Plus className="h-4 w-4" /> Record payment
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Invoice</th>
                    <th className="px-4 py-2.5 font-medium">Client</th>
                    <th className="px-4 py-2.5 font-medium">Method</th>
                    <th className="px-4 py-2.5 font-medium">Reference</th>
                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 hover:bg-accent/40"
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {p.paymentDate?.slice(0, 10)}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{p.invoice?.number ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {p.invoice?.clientSnapshot?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">{PAYMENT_METHOD_LABELS[p.method]}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.reference || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num">
                        {money(p.amount, p.invoice?.currency ?? "INR")}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end">
                          {canEdit ? (
                            <IconButton title="Remove" onClick={() => setToDelete(p)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </IconButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {data && payments.length > 0 ? (
          <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted-foreground">
            <span>
              {data.total} payment{data.total === 1 ? "" : "s"} · {money(data.totalAmount ?? 0)}{" "}
              total{isFetching ? " · updating…" : ""}
            </span>
            {data.totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {data.page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </PageBody>

      {recording ? <RecordPaymentDialog onClose={() => setRecording(false)} /> : null}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        pending={remove.isPending}
        title="Remove this payment?"
        description="The payment will be deleted and the invoice's paid amount and status will be recalculated."
        confirmLabel="Remove"
        onConfirm={runDelete}
      />
    </AppShell>
  );
}

function RecordPaymentDialog({ onClose }: { onClose: () => void }) {
  const { create } = usePaymentMutations();
  // Only issued, not-fully-paid invoices can receive a payment.
  const { data: invoicesPage, isLoading } = useInvoices({
    limit: 100,
    sort: "issueDate",
    order: "desc",
  });
  const payable = useMemo(
    () => (invoicesPage?.data ?? []).filter((i) => i.number && PAYABLE.has(i.status)),
    [invoicesPage],
  );

  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [methodValue, setMethodValue] = useState<PaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const selected = payable.find((i) => i.id === invoiceId);
  const balance = selected ? Math.max(0, selected.grandTotal - selected.amountPaid) : 0;

  const onPickInvoice = (id: string) => {
    setInvoiceId(id);
    const inv = payable.find((i) => i.id === id);
    if (inv) setAmount(String(Math.max(0, inv.grandTotal - inv.amountPaid)));
  };

  const canSave = invoiceId && Number(amount) > 0 && paymentDate && !create.isPending;

  const save = () => {
    create.mutate(
      {
        invoiceId,
        amount: Number(amount),
        paymentDate,
        method: methodValue,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Payment recorded");
          onClose();
        },
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Couldn't record payment"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Invoice</label>
            <select
              className={inputCls}
              value={invoiceId}
              onChange={(e) => onPickInvoice(e.target.value)}
            >
              <option value="">{isLoading ? "Loading invoices…" : "Select an invoice…"}</option>
              {payable.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.number} · {i.clientSnapshot?.name ?? "—"} ·{" "}
                  {money(Math.max(0, i.grandTotal - i.amountPaid), i.currency)} due
                </option>
              ))}
            </select>
            {!isLoading && payable.length === 0 ? (
              <p className="mt-1 text-[12px] text-muted-foreground">
                No issued invoices are awaiting payment.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                Amount{selected ? ` (${money(balance, selected.currency)} due)` : ""}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                className={inputCls}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Method</label>
              <select
                className={inputCls}
                value={methodValue}
                onChange={(e) => setMethodValue(e.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Reference</label>
              <input
                className={inputCls}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Txn / UPI / cheque no."
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${inputCls} min-h-[52px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSave} onClick={save}>
            {create.isPending ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
