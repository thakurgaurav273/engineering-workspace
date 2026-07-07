import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";

export type ClientType = "COMPANY" | "INDIVIDUAL";

export interface Client {
  id: string;
  orgId: string;
  type: ClientType;
  name: string;
  companyName?: string | null;
  contactPersonName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  gstin?: string | null;
  pan?: string | null;
  taxId?: string | null;
  billingLine1?: string | null;
  billingLine2?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  shippingLine1?: string | null;
  shippingLine2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  notes?: string | null;
  tags: string[];
  isActive: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClientListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: ClientType | "";
  archived?: boolean;
  active?: boolean;
  sort?: "name" | "createdAt" | "updatedAt";
  order?: "asc" | "desc";
}

function toQuery(params: ClientListParams): string {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.search) q.set("search", params.search);
  if (params.type) q.set("type", params.type);
  if (params.archived) q.set("archived", "true");
  if (params.active !== undefined) q.set("active", String(params.active));
  if (params.sort) q.set("sort", params.sort);
  if (params.order) q.set("order", params.order);
  return q.toString();
}

export function useClients(params: ClientListParams, enabled = true) {
  return useQuery<Paginated<Client>>({
    queryKey: ["business", "clients", params],
    queryFn: () => api.get(`/business/clients?${toQuery(params)}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useClient(id: string | undefined) {
  return useQuery<Client>({
    queryKey: ["business", "clients", "detail", id],
    queryFn: () => api.get(`/business/clients/${id}`),
    enabled: !!id,
  });
}

export function useClientMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["business", "clients"] });

  return {
    create: useMutation({
      mutationFn: (body: Partial<Client>) => api.post("/business/clients", body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<Client> }) =>
        api.patch(`/business/clients/${id}`, body),
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: (id: string) => api.delete(`/business/clients/${id}`),
      onSuccess: invalidate,
    }),
    restore: useMutation({
      mutationFn: (id: string) => api.post(`/business/clients/${id}/restore`, {}),
      onSuccess: invalidate,
    }),
  };
}
