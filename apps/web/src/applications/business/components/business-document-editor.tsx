import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, Button } from "@/shared/components/primitives";
import { useClients } from "@/applications/business/lib/business-clients";
import { useCompany, useInvoiceTotals, type InvoiceLine } from "@/applications/business/lib/business-invoices";
import { money } from "@/applications/business/lib/business-format";

// Shared editor for business documents (invoices, quotations, …). Behaviour and markup are
// identical to the original InvoiceEditor; only the date field, labels, mutations and
// navigation target are parameterized. Totals always come from the backend Tax Engine.

export interface DocumentEditorModel {
  id: string;
  clientId: string;
  currency: string;
  notes: string | null;
  terms: string | null;
  priceMode: string;
  dueDate?: string | null;
  expiryDate?: string | null;
  lines?: InvoiceLine[];
}

interface SaveCallbacks {
  onSuccess: (doc: { id: string }) => void;
  onError: () => void;
}

interface LineForm {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  discountType: "PERCENT" | "FIXED";
  gstRate: string;
  notes: string;
}
interface FormValues {
  clientId: string;
  currency: string;
  date: string;
  notes: string;
  terms: string;
  priceMode: "EXCLUSIVE" | "INCLUSIVE";
  lines: LineForm[];
}

const EMPTY_LINE: LineForm = {
  description: "",
  quantity: 1,
  unit: "",
  unitPrice: 0,
  discount: 0,
  discountType: "PERCENT",
  gstRate: "18",
  notes: "",
};

function toForm(
  doc: DocumentEditorModel | undefined,
  dateField: "dueDate" | "expiryDate",
): FormValues {
  if (!doc) {
    return {
      clientId: "",
      currency: "INR",
      date: "",
      notes: "",
      terms: "",
      priceMode: "EXCLUSIVE",
      lines: [{ ...EMPTY_LINE }],
    };
  }
  const dateVal = doc[dateField];
  return {
    clientId: doc.clientId,
    currency: doc.currency,
    date: dateVal ? dateVal.slice(0, 10) : "",
    notes: doc.notes ?? "",
    terms: doc.terms ?? "",
    priceMode: (doc.priceMode as "EXCLUSIVE" | "INCLUSIVE") ?? "EXCLUSIVE",
    lines: (doc.lines ?? []).map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit ?? "",
      unitPrice: l.unitPrice,
      discount: l.discount ?? 0,
      discountType: (l.discountType as "PERCENT" | "FIXED") ?? "PERCENT",
      gstRate: l.taxes?.[0]?.rate != null ? String(l.taxes[0].rate) : "",
      notes: l.notes ?? "",
    })),
  };
}

function lineTaxes(gstRate: string) {
  return gstRate === "" ? [] : [{ type: "GST", rate: Number(gstRate) }];
}

function toBody(v: FormValues, dateField: "dueDate" | "expiryDate") {
  return {
    clientId: v.clientId,
    currency: v.currency,
    notes: v.notes || undefined,
    terms: v.terms || undefined,
    [dateField]: v.date || undefined,
    priceMode: v.priceMode,
    lines: v.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity) || 0,
      unit: l.unit || undefined,
      unitPrice: Number(l.unitPrice) || 0,
      discount: Number(l.discount) || 0,
      discountType: l.discountType,
      notes: l.notes || undefined,
      taxes: lineTaxes(l.gstRate),
    })),
  };
}

const inputCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-ring";

export function BusinessDocumentEditor({
  document,
  sectionLabel,
  dateLabel,
  dateField,
  dateRequired,
  savedNoun,
  createPending,
  updatePending,
  onCreate,
  onUpdate,
  onSaved,
}: {
  document?: DocumentEditorModel;
  sectionLabel: string;
  dateLabel: string;
  dateField: "dueDate" | "expiryDate";
  dateRequired?: boolean;
  savedNoun: string;
  createPending: boolean;
  updatePending: boolean;
  onCreate: (body: unknown, cb: SaveCallbacks) => void;
  onUpdate: (id: string, body: unknown, cb: SaveCallbacks) => void;
  onSaved: (id: string) => void;
}) {
  const { data: clientsPage } = useClients({ limit: 100 });
  const { data: company } = useCompany();

  const { register, control, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: toForm(document, dateField),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const clientId = useWatch({ control, name: "clientId" });
  const priceMode = useWatch({ control, name: "priceMode" });
  const lines = useWatch({ control, name: "lines" });
  const client = clientsPage?.data.find((c) => c.id === clientId);

  const rawPayload = useMemo(
    () => ({
      items: (lines ?? []).map((l) => ({
        quantity: Number(l.quantity) || 0,
        price: Number(l.unitPrice) || 0,
        discount: Number(l.discount) || 0,
        discountType: l.discountType,
        taxes: lineTaxes(l.gstRate),
      })),
      companyState: company?.state ?? undefined,
      customerState: client?.billingState ?? undefined,
      customerCountry: client?.billingCountry ?? undefined,
      customerHasGstin: !!client?.gstin,
      priceMode,
    }),
    [lines, priceMode, company, client],
  );
  const payload = useDebounced(rawPayload, 400);
  const totals = useInvoiceTotals(payload, !!clientId && (lines?.length ?? 0) > 0);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (formState.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formState.isDirty]);

  const onSubmit = handleSubmit((values) => {
    if (!values.clientId) {
      toast.error("Select a client");
      return;
    }
    if (dateRequired && !values.date) {
      toast.error(`${dateLabel} is required`);
      return;
    }
    const body = toBody(values, dateField);
    const done = (doc: { id: string }) => {
      toast.success(document ? `${savedNoun} saved` : "Draft created");
      onSaved(doc.id);
    };
    const fail = () => toast.error(`Couldn't save the ${savedNoun.toLowerCase()}`);
    if (document) onUpdate(document.id, body, { onSuccess: done, onError: fail });
    else onCreate(body, { onSuccess: done, onError: fail });
  });

  const pending = createPending || updatePending;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="p-4">
        <SectionTitle>{sectionLabel}</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Labeled label="Company">
            <select className={inputCls} disabled value="__current">
              <option value="__current">
                {company?.displayName || company?.legalName || "Your company"}
              </option>
            </select>
          </Labeled>
          <Labeled label="Client *">
            <select className={inputCls} {...register("clientId", { required: true })}>
              <option value="">Select a client…</option>
              {clientsPage?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Currency">
            <input className={inputCls} {...register("currency")} />
          </Labeled>
          <Labeled label={dateRequired ? `${dateLabel} *` : dateLabel}>
            <input type="date" className={inputCls} {...register("date")} />
          </Labeled>
          <Labeled label="Price mode">
            <select className={inputCls} {...register("priceMode")}>
              <option value="EXCLUSIVE">Tax exclusive</option>
              <option value="INCLUSIVE">Tax inclusive</option>
            </select>
          </Labeled>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Lines</SectionTitle>
          <Button type="button" variant="secondary" onClick={() => append({ ...EMPTY_LINE })}>
            <Plus className="h-3.5 w-3.5" /> Add line
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-1 py-1 font-medium">Description</th>
                <th className="px-1 py-1 font-medium">Qty</th>
                <th className="px-1 py-1 font-medium">Unit</th>
                <th className="px-1 py-1 font-medium">Unit price</th>
                <th className="px-1 py-1 font-medium">Disc %</th>
                <th className="px-1 py-1 font-medium">GST</th>
                <th className="px-1 py-1 font-medium">Notes</th>
                <th className="px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={f.id} className="align-top">
                  <td className="px-1 py-1 min-w-[180px]">
                    <input className={inputCls} {...register(`lines.${i}.description` as const)} />
                  </td>
                  <td className="px-1 py-1 w-16">
                    <input
                      type="number"
                      className={inputCls}
                      {...register(`lines.${i}.quantity` as const)}
                    />
                  </td>
                  <td className="px-1 py-1 w-16">
                    <input className={inputCls} {...register(`lines.${i}.unit` as const)} />
                  </td>
                  <td className="px-1 py-1 w-24">
                    <input
                      type="number"
                      className={inputCls}
                      {...register(`lines.${i}.unitPrice` as const)}
                    />
                  </td>
                  <td className="px-1 py-1 w-16">
                    <input
                      type="number"
                      className={inputCls}
                      {...register(`lines.${i}.discount` as const)}
                    />
                  </td>
                  <td className="px-1 py-1 w-20">
                    <select className={inputCls} {...register(`lines.${i}.gstRate` as const)}>
                      <option value="">None</option>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </td>
                  <td className="px-1 py-1 min-w-[120px]">
                    <input className={inputCls} {...register(`lines.${i}.notes` as const)} />
                  </td>
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      disabled={fields.length === 1}
                      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Notes &amp; terms</SectionTitle>
          <div className="space-y-3">
            <Labeled label="Notes">
              <textarea rows={3} className={inputCls} {...register("notes")} />
            </Labeled>
            <Labeled label="Terms">
              <textarea rows={3} className={inputCls} {...register("terms")} />
            </Labeled>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>Totals</SectionTitle>
            {totals.isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <Totals data={totals.data} />
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : document ? "Save draft" : "Create draft"}
        </Button>
        {formState.isDirty ? (
          <span className="text-[12px] text-muted-foreground">Unsaved changes</span>
        ) : null}
      </div>
    </form>
  );
}

export function Totals({
  data,
}: {
  data?: {
    subtotal: number;
    discountTotal: number;
    taxableTotal: number;
    taxBreakdown: { name: string; rate: number; amount: number }[];
    taxTotal: number;
    roundOff: number;
    grandTotal: number;
  };
}) {
  if (!data)
    return (
      <div className="py-6 text-center text-[13px] text-muted-foreground">
        Add lines and select a client to see totals.
      </div>
    );
  return (
    <div className="text-[13px]">
      <Row label="Subtotal" value={fmt(data.subtotal)} />
      {data.discountTotal ? <Row label="Discount" value={`- ${fmt(data.discountTotal)}`} /> : null}
      <Row label="Taxable" value={fmt(data.taxableTotal)} />
      {data.taxBreakdown.map((b) => (
        <Row key={`${b.name}${b.rate}`} label={`${b.name} @ ${b.rate}%`} value={fmt(b.amount)} />
      ))}
      {data.roundOff ? <Row label="Round off" value={fmt(data.roundOff)} /> : null}
      <div className="mt-1 flex items-center justify-between border-t border-border pt-2 font-semibold">
        <span>Grand total</span>
        <span className="font-mono-num">{fmt(data.grandTotal)}</span>
      </div>
    </div>
  );
}

const fmt = (n: number) => money(n);

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}
function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-num">{value}</span>
    </div>
  );
}
