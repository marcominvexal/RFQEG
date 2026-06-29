"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useSuppliers() {
  return useQuery({ queryKey: ["suppliers"], queryFn: () => api.get<{ suppliers: any[] }>("/api/suppliers").then((r) => r.suppliers) });
}
export function useSupplierMutations() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ["suppliers"] });
  return {
    create: useMutation({ mutationFn: (b: any) => api.post("/api/suppliers", b), onSuccess: inval }),
    update: useMutation({ mutationFn: ({ id, ...b }: any) => api.patch(`/api/suppliers/${id}`, b), onSuccess: inval }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/api/suppliers/${id}`), onSuccess: inval }),
  };
}

export function usePartners() {
  return useQuery({ queryKey: ["partners"], queryFn: () => api.get<{ partners: any[] }>("/api/partners").then((r) => r.partners) });
}
export function usePartnerMutations() {
  const qc = useQueryClient();
  const inval = () => { qc.invalidateQueries({ queryKey: ["partners"] }); qc.invalidateQueries({ queryKey: ["settings"] }); };
  return {
    create: useMutation({ mutationFn: (b: any) => api.post("/api/partners", b), onSuccess: inval }),
    update: useMutation({ mutationFn: ({ id, ...b }: any) => api.patch(`/api/partners/${id}`, b), onSuccess: inval }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/api/partners/${id}`), onSuccess: inval }),
  };
}

export function useAiLogs(enabled = true) {
  return useQuery({ queryKey: ["ai-logs"], queryFn: () => api.get<any>("/api/ai-logs"), enabled, retry: false });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { key: string; value: any }) => api.patch("/api/settings", b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
