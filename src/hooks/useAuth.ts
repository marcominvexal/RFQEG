"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AuthUser } from "@/types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ user: AuthUser }>("/api/auth/me").then((r) => r.user),
    retry: false,
  });
}
