import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody, Card, Button } from "@grovyn/ui/primitives";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import {
  useDocNumbering,
  useUpdateDocNumbering,
  previewNumber,
  DOCUMENT_TYPE_LABELS,
  type DocNumberingConfig,
  type BusinessDocumentType,
} from "@/applications/business/lib/business-document-numbering";
import { TaxConfigPanel } from "@/applications/business/components/tax-config-panel";

export function BusinessSettingsPage() {
  const navigate = useRouter();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate.replace("/");
    else if (!appsLoading && !available) navigate.replace("/apps");
  }, [appsLoading, available, navigate]);

  const { data, isLoading, isError } = useDocNumbering(flags.platformShell && available);
  const update = useUpdateDocNumbering();

  const [tab, setTab] = useState<"numbering" | "tax">("numbering");
  const [selected, setSelected] = useState<BusinessDocumentType>("INVOICE");
  const [form, setForm] = useState<DocNumberingConfig | null>(null);

  useEffect(() => {
    const cfg = data?.find((c) => c.documentType === selected);
    if (cfg) setForm({ ...cfg });
  }, [data, selected]);

  if (!flags.platformShell || appsLoading || !available) return null;

  const set = <K extends keyof DocNumberingConfig>(key: K, value: DocNumberingConfig[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = () => {
    if (!form) return;
    update.mutate(
      {
        type: selected,
        body: {
          prefix: form.prefix,
          suffix: form.suffix,
          separator: form.separator,
          startNumber: form.startNumber,
          currentNumber: form.currentNumber,
          padding: form.padding,
          resetMode: form.resetMode,
          useFinancialYear: form.useFinancialYear,
        },
      },
      {
        onSuccess: () => toast.success("Numbering saved"),
        onError: () => toast.error("Couldn't save numbering"),
      },
    );
  };

  return (
    <AppShell>
      <PageHeader title="Settings" description="Business Operations" />
      <PageBody>
        <div className="mb-4 flex gap-1 border-b border-border">
          {(["numbering", "tax"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
                tab === t
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "numbering" ? "Document Numbering" : "Tax Configuration"}
            </button>
          ))}
        </div>

        {tab === "tax" ? (
          <TaxConfigPanel canEdit={canEdit} enabled={flags.platformShell && available} />
        ) : isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError || !form ? (
          <Card className="p-6 text-[13px] text-muted-foreground">
            Couldn't load numbering configuration.
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Document type</span>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value as BusinessDocumentType)}
                className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]"
              >
                {(Object.keys(DOCUMENT_TYPE_LABELS) as BusinessDocumentType[]).map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {/* Live preview */}
            <Card className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Preview (next number)
              </div>
              <div className="mt-1 font-mono-num text-lg font-semibold tracking-tight">
                {previewNumber(form)}
              </div>
            </Card>

            <Card className="p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Text
                  label="Prefix"
                  value={form.prefix}
                  onChange={(v) => set("prefix", v)}
                  disabled={!canEdit}
                />
                <Text
                  label="Suffix"
                  value={form.suffix}
                  onChange={(v) => set("suffix", v)}
                  disabled={!canEdit}
                />
                <Text
                  label="Separator"
                  value={form.separator}
                  onChange={(v) => set("separator", v)}
                  disabled={!canEdit}
                />
                <Num
                  label="Padding length"
                  value={form.padding}
                  onChange={(v) => set("padding", v)}
                  disabled={!canEdit}
                />
                <Num
                  label="Starting number"
                  value={form.startNumber}
                  onChange={(v) => set("startNumber", v)}
                  disabled={!canEdit}
                />
                <Num
                  label="Current number (last issued)"
                  value={form.currentNumber}
                  onChange={(v) => set("currentNumber", v)}
                  disabled={!canEdit}
                />
                <label className="block">
                  <span className="text-[12px] text-muted-foreground">Reset policy</span>
                  <select
                    value={form.resetMode}
                    disabled={!canEdit}
                    onChange={(e) =>
                      set("resetMode", e.target.value as DocNumberingConfig["resetMode"])
                    }
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] disabled:opacity-60"
                  >
                    <option value="NEVER">Never reset</option>
                    <option value="YEARLY">Reset yearly</option>
                    <option value="MONTHLY">Reset monthly</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 pt-5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={form.useFinancialYear}
                    disabled={!canEdit}
                    onChange={(e) => set("useFinancialYear", e.target.checked)}
                  />
                  Financial year mode (Apr–Mar)
                </label>
              </div>

              {canEdit ? (
                <div className="mt-4">
                  <Button onClick={save} disabled={update.isPending}>
                    {update.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              ) : (
                <p className="mt-4 text-[12px] text-muted-foreground">
                  Only organization owners and admins can change numbering.
                </p>
              )}
            </Card>
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}

function Text({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-ring disabled:opacity-60"
      />
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-ring disabled:opacity-60"
      />
    </label>
  );
}
