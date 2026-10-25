'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Paperclip, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/primitives';
import { Empty } from '@/components/page';

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

/** Evidence attachments (validated server-side: type, magic bytes, size; stored with SHA-256). */
export function Attachments({ entityType, entityId, canUpload }: { entityType: string; entityId: string; canUpload: boolean }) {
  const qc = useQueryClient();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const { data } = useQuery({ queryKey: ['attachments', entityType, entityId], queryFn: () => api.get<Attachment[]>(`/attachments/${entityType}/${entityId}`) });
  const upload = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    try {
      await api.upload(`/attachments/${entityType}/${entityId}`, form);
      toast.success(`${file.name} attached`);
      qc.invalidateQueries({ queryKey: ['attachments', entityType, entityId] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="space-y-2">
      {data?.length ? (
        data.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-[13px]">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{a.fileName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {(a.sizeBytes / 1024).toFixed(1)} KB · {fmtDateTime(a.createdAt)} · SHA-256 {a.sha256.slice(0, 12)}…
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => api.download(`/attachments/file/${a.id}`)} aria-label={`Download ${a.fileName}`}>
              <Download />
            </Button>
          </div>
        ))
      ) : (
        <Empty>No evidence attached.</Empty>
      )}
      {canUpload && (
        <>
          <input ref={input} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx,.csv,.txt" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button variant="outline" size="sm" onClick={() => input.current?.click()} loading={busy}>
            <Upload /> Attach evidence
          </Button>
          <p className="text-xs text-muted-foreground">PDF, PNG, JPG, XLSX, DOCX, CSV or TXT, up to 10 MB. Attachments cannot be deleted (regulated record).</p>
        </>
      )}
    </div>
  );
}
