"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function UpdateFromEmailButton() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.post<{ importedCount: number; scanned: number }>("/api/update-from-email");
      setMsg(`Imported ${r.importedCount} of ${r.scanned} scanned`);
      qc.invalidateQueries({ queryKey: ["rfqs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Update From Email
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
