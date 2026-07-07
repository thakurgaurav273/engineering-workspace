import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { Paginated } from "@/applications/business/lib/business-invoices";

export type OfferLetterStatus =
  "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";

export interface OfferLetter {
  id: string;
  orgId: string;
  number: string | null;
  status: OfferLetterStatus;
  offerDate: string | null;
  validUntil: string | null;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  candidateAddress: string | null;
  position: string;
  department: string | null;
  designation: string | null;
  reportingManager: string | null;
  startDate: string | null;
  employmentType: EmploymentType;
  workLocation: string | null;
  baseSalary: number;
  currency: string;
  variablePay: number | null;
  salaryBreakdown: string | null;
  benefits: string | null;
  noticePeriod: string | null;
  probationPeriod: string | null;
  termsAndConditions: string | null;
  additionalNotes: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

export interface OfferLetterListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: OfferLetterStatus | "";
  employmentType?: EmploymentType | "";
  sort?: "createdAt" | "offerDate" | "candidateName";
  order?: "asc" | "desc";
}

function toQuery(p: OfferLetterListParams): string {
  const q = new URLSearchParams();
  if (p.page) q.set("page", String(p.page));
  if (p.limit) q.set("limit", String(p.limit));
  if (p.search) q.set("search", p.search);
  if (p.status) q.set("status", p.status);
  if (p.employmentType) q.set("employmentType", p.employmentType);
  if (p.sort) q.set("sort", p.sort);
  if (p.order) q.set("order", p.order);
  return q.toString();
}

export function useOfferLetters(params: OfferLetterListParams, enabled = true) {
  return useQuery<Paginated<OfferLetter>>({
    queryKey: ["business", "offer-letters", params],
    queryFn: () => api.get(`/business/offer-letters?${toQuery(params)}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useOfferLetter(id: string | undefined) {
  return useQuery<OfferLetter>({
    queryKey: ["business", "offer-letters", "detail", id],
    queryFn: () => api.get(`/business/offer-letters/${id}`),
    enabled: !!id,
  });
}

export interface OfferLetterPreview {
  to: string;
  subject: string;
  html: string;
}

/** The exact rendered document + recipient/subject that Send would email. */
export function useOfferLetterPreview(id: string | undefined, enabled: boolean) {
  return useQuery<OfferLetterPreview>({
    queryKey: ["business", "offer-letters", "preview", id],
    queryFn: () => api.get(`/business/offer-letters/${id}/preview`),
    enabled: !!id && enabled,
  });
}

export function useOfferLetterMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["business", "offer-letters"] });
    qc.invalidateQueries({ queryKey: ["business", "dashboard"] });
    if (id) qc.invalidateQueries({ queryKey: ["business", "offer-letters", "detail", id] });
  };
  const action = (verb: string) => ({
    mutationFn: (id: string) => api.post<OfferLetter>(`/business/offer-letters/${id}/${verb}`, {}),
    onSuccess: (_d: OfferLetter, id: string) => invalidate(id),
  });
  return {
    create: useMutation({
      mutationFn: (body: unknown) => api.post<OfferLetter>("/business/offer-letters", body),
      onSuccess: () => invalidate(),
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: unknown }) =>
        api.patch<OfferLetter>(`/business/offer-letters/${id}`, body),
      onSuccess: (_d, v) => invalidate(v.id),
    }),
    send: useMutation(action("send")),
    accept: useMutation(action("accept")),
    reject: useMutation(action("reject")),
    cancel: useMutation(action("cancel")),
    duplicate: useMutation({
      mutationFn: (id: string) =>
        api.post<OfferLetter>(`/business/offer-letters/${id}/duplicate`, {}),
      onSuccess: () => invalidate(),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/business/offer-letters/${id}`),
      onSuccess: () => invalidate(),
    }),
  };
}

export const OFFER_LETTER_STATUS_LABELS: Record<OfferLetterStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
};

export const EMPLOYMENT_TYPES = Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[];
