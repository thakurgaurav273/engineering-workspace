import { useEffect, type ReactNode, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody, Card, Button } from "@grovyn/ui/primitives";
import { api } from "@/shared/lib/api";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";


interface CompanyProfile {
  legalName: string;
  displayName?: string | null;
  logoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  gstin?: string | null;
  pan?: string | null;
  cin?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  invoiceFooterNotes?: string | null;
  authorizedSignatoryName?: string | null;
  authorizedSignatoryDesignation?: string | null;
}

type FormValues = Record<keyof CompanyProfile, string>;

const EMPTY: FormValues = {
  legalName: "",
  displayName: "",
  logoUrl: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  gstin: "",
  pan: "",
  cin: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  upiId: "",
  contactEmail: "",
  contactPhone: "",
  website: "",
  invoiceFooterNotes: "",
  authorizedSignatoryName: "",
  authorizedSignatoryDesignation: "",
};

function toForm(data: CompanyProfile | null): FormValues {
  if (!data) return EMPTY;
  const out = { ...EMPTY };
  (Object.keys(EMPTY) as (keyof FormValues)[]).forEach((k) => {
    out[k] = (data[k] ?? "") as string;
  });
  return out;
}

export function CompanyProfilePage() {
  const navigate = useRouter();
  const queryClient = useQueryClient();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate.replace("/");
    else if (!appsLoading && !available) navigate.replace("/");
  }, [appsLoading, available, navigate]);

  const { data, isLoading, isError } = useQuery<CompanyProfile | null>({
    queryKey: ["business", "company"],
    queryFn: () => api.get("/business/company"),
    enabled: flags.platformShell && available,
  });

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (data !== undefined) reset(toForm(data));
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.patch("/business/company", clean(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "company"] });
      toast.success("Company profile saved");
    },
    onError: () => toast.error("Couldn't save the company profile"),
  });

  if (!flags.platformShell || appsLoading || !available) return null;

  return (
    <AppShell>
      <PageHeader title="Company Profile" description="Business Operations" />
      <PageBody>
        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError ? (
          <Card className="p-6 text-[13px] text-muted-foreground">
            Couldn't load the company profile. Please try again.
          </Card>
        ) : (
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            {!data ? (
              <Card className="p-4 text-[13px] text-muted-foreground">
                No company profile yet — fill in your company details below and save to create one.
                This information appears on invoices, quotations and other business documents.
              </Card>
            ) : null}

            <Section title="Company">
              <Field label="Legal name" required {...register("legalName", { required: true })} />
              <Field label="Display name" {...register("displayName")} />
              <Field label="Website" {...register("website")} />
              <Field label="Logo URL" {...register("logoUrl")} />
            </Section>

            <Section title="Address">
              <Field label="Address line 1" {...register("addressLine1")} />
              <Field label="Address line 2" {...register("addressLine2")} />
              <Field label="City" {...register("city")} />
              <Field label="State" {...register("state")} />
              <Field label="Postal code" {...register("postalCode")} />
              <Field label="Country" {...register("country")} />
            </Section>

            <Section title="Tax">
              <Field label="GSTIN" {...register("gstin")} />
              <Field label="PAN" {...register("pan")} />
              <Field label="CIN" {...register("cin")} />
            </Section>

            <Section title="Bank">
              <Field label="Bank name" {...register("bankName")} />
              <Field label="Account name" {...register("bankAccountName")} />
              <Field label="Account number" {...register("bankAccountNumber")} />
              <Field label="IFSC" {...register("bankIfsc")} />
              <Field label="UPI ID" {...register("upiId")} />
            </Section>

            <Section title="Contact">
              <Field label="Contact email" type="email" {...register("contactEmail")} />
              <Field label="Contact phone" {...register("contactPhone")} />
            </Section>

            <Section title="Documents">
              <Field label="Authorized signatory" {...register("authorizedSignatoryName")} />
              <Field
                label="Signatory designation"
                {...register("authorizedSignatoryDesignation")}
              />
              <Field label="Invoice footer notes" full {...register("invoiceFooterNotes")} />
            </Section>

            {canEdit ? (
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={mutation.isPending || !formState.isDirty}>
                  {mutation.isPending ? "Saving…" : "Save changes"}
                </Button>
                {formState.isDirty ? (
                  <span className="text-[12px] text-muted-foreground">Unsaved changes</span>
                ) : null}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                Only organization owners and admins can edit the company profile.
              </p>
            )}
          </form>
        )}
      </PageBody>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-3 text-[12px] font-semibold tracking-tight">{title}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

const Field = ({
  label,
  required,
  full,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  required?: boolean;
  full?: boolean;
}) => (
  <label className={`block ${full ? "sm:col-span-2" : ""}`}>
    <span className="text-[12px] text-muted-foreground">
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
    </span>
    <input
      className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring disabled:opacity-60"
      {...props}
    />
  </label>
);

/** Strip empty strings so cleared optional fields become null server-side. */
function clean(values: FormValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v !== "") out[k] = v;
  }
  if (!out.legalName) out.legalName = values.legalName;
  return out;
}
