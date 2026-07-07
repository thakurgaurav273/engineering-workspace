import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, Button } from "@/components/primitives";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes";
import {
  useOfferLetterMutations,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  type OfferLetter,
  type EmploymentType,
} from "@/lib/business-offer-letters";

const inputCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-ring";
const labelCls = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

function Field({ label, children }: { label: string; children: ReactNode }) {
  // Wrapping the control in the <label> gives an implicit, screen-reader-correct
  // association without needing to thread ids through every input.
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function Section({
  title,
  children,
  cols = 2,
}: {
  title: string;
  children: ReactNode;
  cols?: number;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className={`grid gap-3 ${cols === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
        {children}
      </div>
    </Card>
  );
}

type FormState = Record<string, string>;

export function OfferLetterEditor({ offer }: { offer?: OfferLetter }) {
  const navigate = useNavigate();
  const { create, update } = useOfferLetterMutations();

  const [f, setF] = useState<FormState>(() => ({
    candidateName: offer?.candidateName ?? "",
    candidateEmail: offer?.candidateEmail ?? "",
    candidatePhone: offer?.candidatePhone ?? "",
    candidateAddress: offer?.candidateAddress ?? "",
    position: offer?.position ?? "",
    department: offer?.department ?? "",
    designation: offer?.designation ?? "",
    reportingManager: offer?.reportingManager ?? "",
    startDate: offer?.startDate?.slice(0, 10) ?? "",
    employmentType: offer?.employmentType ?? "FULL_TIME",
    workLocation: offer?.workLocation ?? "",
    baseSalary: offer?.baseSalary != null ? String(offer.baseSalary) : "",
    currency: offer?.currency ?? "INR",
    variablePay: offer?.variablePay != null ? String(offer.variablePay) : "",
    salaryBreakdown: offer?.salaryBreakdown ?? "",
    benefits: offer?.benefits ?? "",
    noticePeriod: offer?.noticePeriod ?? "",
    probationPeriod: offer?.probationPeriod ?? "",
    termsAndConditions: offer?.termsAndConditions ?? "",
    additionalNotes: offer?.additionalNotes ?? "",
    offerDate: offer?.offerDate?.slice(0, 10) ?? "",
    validUntil: offer?.validUntil?.slice(0, 10) ?? "",
  }));

  const set = (k: string) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  // Warn before leaving with unsaved edits (pristine snapshot captured on first render).
  const initialRef = useRef<string | null>(null);
  const snapshot = JSON.stringify(f);
  if (initialRef.current === null) initialRef.current = snapshot;
  useUnsavedChangesWarning(snapshot !== initialRef.current);

  const pending = create.isPending || update.isPending;
  const canSave =
    f.candidateName.trim() && f.candidateEmail.trim() && f.position.trim() && !pending;

  const save = () => {
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
    const str = (v: string) => (v.trim() === "" ? undefined : v.trim());
    const body = {
      candidateName: f.candidateName.trim(),
      candidateEmail: f.candidateEmail.trim(),
      candidatePhone: str(f.candidatePhone),
      candidateAddress: str(f.candidateAddress),
      position: f.position.trim(),
      department: str(f.department),
      designation: str(f.designation),
      reportingManager: str(f.reportingManager),
      startDate: f.startDate || undefined,
      employmentType: f.employmentType as EmploymentType,
      workLocation: str(f.workLocation),
      baseSalary: num(f.baseSalary),
      currency: f.currency || "INR",
      variablePay: num(f.variablePay),
      salaryBreakdown: str(f.salaryBreakdown),
      benefits: str(f.benefits),
      noticePeriod: str(f.noticePeriod),
      probationPeriod: str(f.probationPeriod),
      termsAndConditions: str(f.termsAndConditions),
      additionalNotes: str(f.additionalNotes),
      offerDate: f.offerDate || undefined,
      validUntil: f.validUntil || undefined,
    };
    const onSaved = (o: OfferLetter) => {
      toast.success("Offer letter saved");
      navigate({ to: "/business/offer-letters/$id", params: { id: o.id } });
    };
    const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't save");
    if (offer) update.mutate({ id: offer.id, body }, { onSuccess: onSaved, onError });
    else create.mutate(body, { onSuccess: onSaved, onError });
  };

  return (
    <div className="space-y-4">
      <Section title="Candidate">
        <Field label="Full name">
          <input className={inputCls} value={f.candidateName} onChange={set("candidateName")} />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={inputCls}
            value={f.candidateEmail}
            onChange={set("candidateEmail")}
          />
        </Field>
        <Field label="Phone">
          <input className={inputCls} value={f.candidatePhone} onChange={set("candidatePhone")} />
        </Field>
        <Field label="Address">
          <input
            className={inputCls}
            value={f.candidateAddress}
            onChange={set("candidateAddress")}
          />
        </Field>
      </Section>

      <Section title="Role">
        <Field label="Position">
          <input className={inputCls} value={f.position} onChange={set("position")} />
        </Field>
        <Field label="Designation">
          <input className={inputCls} value={f.designation} onChange={set("designation")} />
        </Field>
        <Field label="Department">
          <input className={inputCls} value={f.department} onChange={set("department")} />
        </Field>
        <Field label="Reporting manager">
          <input
            className={inputCls}
            value={f.reportingManager}
            onChange={set("reportingManager")}
          />
        </Field>
        <Field label="Employment type">
          <select className={inputCls} value={f.employmentType} onChange={set("employmentType")}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Work location">
          <input className={inputCls} value={f.workLocation} onChange={set("workLocation")} />
        </Field>
        <Field label="Start date">
          <input type="date" className={inputCls} value={f.startDate} onChange={set("startDate")} />
        </Field>
      </Section>

      <Section title="Compensation">
        <Field label="Base salary (annual)">
          <input
            type="number"
            min="0"
            step="1"
            className={inputCls}
            value={f.baseSalary}
            onChange={set("baseSalary")}
          />
        </Field>
        <Field label="Currency">
          <input className={inputCls} value={f.currency} onChange={set("currency")} />
        </Field>
        <Field label="Variable pay">
          <input
            type="number"
            min="0"
            step="1"
            className={inputCls}
            value={f.variablePay}
            onChange={set("variablePay")}
          />
        </Field>
        <Field label="Benefits">
          <input className={inputCls} value={f.benefits} onChange={set("benefits")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Salary breakdown">
            <textarea
              className={`${inputCls} min-h-[56px] resize-y`}
              value={f.salaryBreakdown}
              onChange={set("salaryBreakdown")}
            />
          </Field>
        </div>
      </Section>

      <Section title="Terms">
        <Field label="Notice period">
          <input className={inputCls} value={f.noticePeriod} onChange={set("noticePeriod")} />
        </Field>
        <Field label="Probation period">
          <input className={inputCls} value={f.probationPeriod} onChange={set("probationPeriod")} />
        </Field>
        <Field label="Offer date">
          <input type="date" className={inputCls} value={f.offerDate} onChange={set("offerDate")} />
        </Field>
        <Field label="Valid until">
          <input
            type="date"
            className={inputCls}
            value={f.validUntil}
            onChange={set("validUntil")}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Terms & conditions">
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={f.termsAndConditions}
              onChange={set("termsAndConditions")}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Additional notes">
            <textarea
              className={`${inputCls} min-h-[56px] resize-y`}
              value={f.additionalNotes}
              onChange={set("additionalNotes")}
            />
          </Field>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button disabled={!canSave} onClick={save}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {offer ? "Save changes" : "Create offer letter"}
        </Button>
      </div>
    </div>
  );
}
