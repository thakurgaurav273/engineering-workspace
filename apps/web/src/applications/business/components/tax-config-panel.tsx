import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Button } from "@grovyn/ui/primitives";
import { api } from "@/shared/lib/api";

interface TaxConfig {
  regime: string;
  homeCountry: string;
  defaultGstRate: number;
  defaultVatRate: number;
  priceMode: "EXCLUSIVE" | "INCLUSIVE";
  roundingMode: "NONE" | "NEAREST" | "UP" | "DOWN";
}

interface TaxSummary {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  taxBreakdown: { name: string; rate: number; amount: number }[];
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  effectiveRate: number;
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function TaxConfigPanel({ canEdit, enabled }: { canEdit: boolean; enabled: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery<TaxConfig>({
    queryKey: ["business", "tax", "config"],
    queryFn: () => api.get("/business/tax/config"),
    enabled,
  });

  const [form, setForm] = useState<TaxConfig | null>(null);
  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  const save = useMutation({
    mutationFn: (body: Partial<TaxConfig>) => api.patch("/business/tax/config", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business", "tax", "config"] });
      toast.success("Tax settings saved");
    },
    onError: () => toast.error("Couldn't save tax settings"),
  });

  // Live preview calculator
  const [price, setPrice] = useState(1000);
  const [qty, setQty] = useState(1);
  const [rate, setRate] = useState(18);
  const [interState, setInterState] = useState(false);

  const preview = useQuery<TaxSummary>({
    queryKey: ["business", "tax", "preview", price, qty, rate, interState],
    queryFn: () =>
      api.post("/business/tax/calculate", {
        items: [{ quantity: qty, price, taxes: [{ type: "GST", rate }] }],
        companyState: "HomeState",
        customerState: interState ? "OtherState" : "HomeState",
      }),
    enabled: enabled && price >= 0,
  });

  if (isLoading)
    return <Card className="p-6 text-[13px] text-muted-foreground">Loading tax settings…</Card>;
  if (isError || !form)
    return (
      <Card className="p-6 text-[13px] text-muted-foreground">Couldn't load tax settings.</Card>
    );

  const set = <K extends keyof TaxConfig>(k: K, v: TaxConfig[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Defaults
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Default GST rate (%)">
            <input
              type="number"
              value={form.defaultGstRate}
              disabled={!canEdit}
              onChange={(e) => set("defaultGstRate", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Default VAT rate (%)">
            <input
              type="number"
              value={form.defaultVatRate}
              disabled={!canEdit}
              onChange={(e) => set("defaultVatRate", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Default tax mode">
            <select
              value={form.priceMode}
              disabled={!canEdit}
              onChange={(e) => set("priceMode", e.target.value as TaxConfig["priceMode"])}
              className={inputCls}
            >
              <option value="EXCLUSIVE">Exclusive (tax added on top)</option>
              <option value="INCLUSIVE">Inclusive (price includes tax)</option>
            </select>
          </Field>
          <Field label="Default rounding">
            <select
              value={form.roundingMode}
              disabled={!canEdit}
              onChange={(e) => set("roundingMode", e.target.value as TaxConfig["roundingMode"])}
              className={inputCls}
            >
              <option value="NONE">No rounding</option>
              <option value="NEAREST">Nearest</option>
              <option value="UP">Round up</option>
              <option value="DOWN">Round down</option>
            </select>
          </Field>
          <Field label="Regime">
            <select
              value={form.regime}
              disabled={!canEdit}
              onChange={(e) => set("regime", e.target.value)}
              className={inputCls}
            >
              <option value="IN_GST">India GST</option>
              <option value="GCC_VAT">GCC VAT</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </Field>
          <Field label="Home country">
            <input
              value={form.homeCountry}
              disabled={!canEdit}
              onChange={(e) => set("homeCountry", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        {canEdit ? (
          <div className="mt-4">
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-[12px] text-muted-foreground">
            Only owners and admins can change tax settings.
          </p>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Preview calculator
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Price">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Quantity">
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="GST rate (%)">
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <label className="flex items-center gap-2 pt-5 text-[13px]">
            <input
              type="checkbox"
              checked={interState}
              onChange={(e) => setInterState(e.target.checked)}
            />{" "}
            Different state (IGST)
          </label>
        </div>

        {preview.data ? (
          <div className="mt-4 rounded-lg border border-border bg-surface/40 p-3 text-[13px]">
            <Row label="Subtotal" value={money(preview.data.subtotal)} />
            <Row label="Taxable" value={money(preview.data.taxableTotal)} />
            {preview.data.taxBreakdown.map((b) => (
              <Row
                key={`${b.name}${b.rate}`}
                label={`${b.name} @ ${b.rate}%`}
                value={money(b.amount)}
              />
            ))}
            <Row label="Tax total" value={money(preview.data.taxTotal)} />
            {preview.data.roundOff !== 0 ? (
              <Row label="Round-off" value={money(preview.data.roundOff)} />
            ) : null}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2 font-semibold">
              <span>Grand total</span>
              <span className="font-mono-num">{money(preview.data.grandTotal)}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Effective rate: {preview.data.effectiveRate}%
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-ring disabled:opacity-60";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] text-muted-foreground">{label}</span>
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
