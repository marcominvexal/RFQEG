"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { RfqListItem } from "@/types";

export interface RfqQuery {
  status?: string; pendingWith?: string; partner?: string; customer?: string;
  service?: string; search?: string; page?: number; pageSize?: number;
}

export function useRfqs(q: RfqQuery) {
  const qs = new URLSearchParams(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== "") as [string, string][]
  ).toString();
  return useQuery({
    queryKey: ["rfqs", q],
    queryFn: () =>
      api.get<{ items: RfqListItem[]; total: number; page: number; pageSize: number }>(
        `/api/rfqs?${qs}`
      ),
    refetchInterval: 60_000, // live delay counters
  });
}

export function useRfq(id: string | null) {
  return useQuery({
    queryKey: ["rfq", id],
    enabled: !!id,
    queryFn: () => api.get<{ rfq: any }>(`/api/rfqs/${id}`).then((r) => r.rfq),
    refetchInterval: 30_000, // live delay counters while the ticket is open
  });
}

export function useUpdateRfq(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, any>) => api.patch(`/api/rfqs/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rfq", id] });
      qc.invalidateQueries({ queryKey: ["rfqs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: "INTERNAL" | "SUPPLIER"; body: string }) =>
      api.post(`/api/rfqs/${id}/comments`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfq", id] }),
  });
}

export function useAiOffer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ recommendation: any }>(`/api/rfqs/${id}/ai-offer`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfq", id] }),
  });
}

export function useBulkUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids: string[]; patch: Record<string, any> }) => api.patch("/api/rfqs/bulk", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rfqs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useEmailReply(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { to?: string; subject?: string; body: string }) =>
      api.post(`/api/rfqs/${id}/email/reply`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfq", id] }),
  });
}

export function useEmailSummary(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ summary: string }>(`/api/rfqs/${id}/email/summary`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfq", id] }),
  });
}

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<any>("/api/dashboard") });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => api.get<any>("/api/settings") });
}
