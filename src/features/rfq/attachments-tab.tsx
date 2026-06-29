"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Paperclip, Upload, Download, Eye, Trash2, Loader2, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

const PREVIEWABLE = ["application/pdf", "image/png", "image/jpeg"];

export function AttachmentsTab({ rfq }: { rfq: any }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachments = rfq.attachments ?? [];

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/rfqs/${rfq.id}/attachments`, { method: "POST", body: fd, credentials: "include" });
        if (!res.ok) {
          const e = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(e.error || "Upload failed");
        }
      }
      qc.invalidateQueries({ queryKey: ["rfq", rfq.id] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    await api.del(`/api/attachments/${id}`);
    qc.invalidateQueries({ queryKey: ["rfq", rfq.id] });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.msg,.zip,.txt,.png,.jpg,.jpeg"
          onChange={(e) => upload(e.target.files)}
        />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
        </Button>
        {attachments.length > 0 && (
          <a href={`/api/rfqs/${rfq.id}/attachments/zip`}>
            <Button variant="outline" size="sm"><FileArchive className="h-3.5 w-3.5" /> Download all</Button>
          </a>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">PDF, DOCX, XLSX, MSG, ZIP, TXT, images · max 25 MB</p>

      {attachments.length ? (
        <ul className="space-y-2">
          {attachments.map((a: any) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{a.fileName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{(a.sizeBytes / 1024).toFixed(0)} KB</span>
              {PREVIEWABLE.includes(a.mimeType) && (
                <a href={`/api/attachments/${a.id}?inline=1`} target="_blank" rel="noopener noreferrer" title="Preview">
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                </a>
              )}
              <a href={`/api/attachments/${a.id}`} title="Download">
                <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
              </a>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(a.id)} title="Delete">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <Paperclip className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No attachments yet.</p>
        </div>
      )}
    </div>
  );
}
