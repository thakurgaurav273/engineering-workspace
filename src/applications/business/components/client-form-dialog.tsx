import { useEffect, type InputHTMLAttributes, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/primitives";
import { useClientMutations, type Client } from "@/applications/business/lib/business-clients";

const FIELDS = [
  "name",
  "type",
  "companyName",
  "contactPersonName",
  "email",
  "phone",
  "website",
  "gstin",
  "pan",
  "taxId",
  "billingLine1",
  "billingLine2",
  "billingCity",
  "billingState",
  "billingPostalCode",
  "billingCountry",
  "shippingLine1",
  "shippingLine2",
  "shippingCity",
  "shippingState",
  "shippingPostalCode",
  "shippingCountry",
  "notes",
  "tags",
] as const;

type FieldName = (typeof FIELDS)[number];
type FormValues = Record<FieldName, string> & { isActive: boolean };

function toForm(client?: Client): FormValues {
  const out = {} as Record<FieldName, string>;
  for (const f of FIELDS) out[f] = "";
  out.type = "COMPANY";
  out.billingCountry = "India";
  if (client) {
    for (const f of FIELDS) {
      if (f === "tags") out.tags = (client.tags ?? []).join(", ");
      else out[f] = ((client as unknown as Record<string, unknown>)[f] as string) ?? "";
    }
  }
  return { ...(out as FormValues), isActive: client ? client.isActive : true };
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client?: Client;
  onSaved?: () => void;
}) {
  const { create, update } = useClientMutations();
  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: toForm(client) });

  useEffect(() => {
    if (open) reset(toForm(client));
  }, [open, client, reset]);

  const submit = handleSubmit((values) => {
    const body: Record<string, unknown> = { isActive: values.isActive };
    for (const f of FIELDS) {
      if (f === "tags") {
        body.tags = values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      } else if (values[f] !== "") {
        body[f] = values[f];
      }
    }
    if (!body.name) body.name = values.name;

    const onDone = () => {
      toast.success(client ? "Client updated" : "Client created");
      onOpenChange(false);
      onSaved?.();
    };
    const onFail = () => toast.error("Couldn't save the client");

    if (client) update.mutate({ id: client.id, body }, { onSuccess: onDone, onError: onFail });
    else create.mutate(body, { onSuccess: onDone, onError: onFail });
  });

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{client ? "Edit client" : "New client"}</DialogTitle>
        </DialogHeader>

        <form id="client-form" onSubmit={submit} className="space-y-4">
          <Section title="Client">
            <Field label="Name" required {...register("name", { required: true })} />
            <label className="block">
              <span className="text-[12px] text-muted-foreground">Type</span>
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px]"
                {...register("type")}
              >
                <option value="COMPANY">Company</option>
                <option value="INDIVIDUAL">Individual</option>
              </select>
            </label>
            <Field label="Company name" {...register("companyName")} />
            <Field label="Contact person" {...register("contactPersonName")} />
            <Field label="Email" type="email" {...register("email")} />
            <Field label="Phone" {...register("phone")} />
            <Field label="Website" {...register("website")} />
            <label className="flex items-center gap-2 pt-5 text-[13px]">
              <input type="checkbox" {...register("isActive")} /> Active
            </label>
          </Section>

          <Section title="Tax">
            <Field label="GSTIN" {...register("gstin")} />
            <Field label="PAN" {...register("pan")} />
            <Field label="Tax ID" {...register("taxId")} />
          </Section>

          <Section title="Billing address">
            <Field label="Line 1" {...register("billingLine1")} />
            <Field label="Line 2" {...register("billingLine2")} />
            <Field label="City" {...register("billingCity")} />
            <Field label="State" {...register("billingState")} />
            <Field label="Postal code" {...register("billingPostalCode")} />
            <Field label="Country" {...register("billingCountry")} />
          </Section>

          <Section title="Shipping address">
            <Field label="Line 1" {...register("shippingLine1")} />
            <Field label="Line 2" {...register("shippingLine2")} />
            <Field label="City" {...register("shippingCity")} />
            <Field label="State" {...register("shippingState")} />
            <Field label="Postal code" {...register("shippingPostalCode")} />
            <Field label="Country" {...register("shippingCountry")} />
          </Section>

          <Section title="Other">
            <Field label="Tags (comma separated)" full {...register("tags")} />
            <Field label="Notes" full {...register("notes")} />
          </Section>
        </form>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} type="button">
            Cancel
          </Button>
          <Button type="submit" form="client-form" disabled={pending}>
            {pending ? "Saving…" : client ? "Save changes" : "Create client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
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
      className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-ring"
      {...props}
    />
  </label>
);
