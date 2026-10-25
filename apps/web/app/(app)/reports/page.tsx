'use client';

import Link from 'next/link';
import { Download, ExternalLink, FileSpreadsheet, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card } from '@/components/ui/primitives';
import { PageHeader } from '@/components/page';

interface Report {
  title: string;
  description: string;
  perm: Parameters<ReturnType<typeof useAuth>['can']>[0];
  download?: string;
  params?: Record<string, string>;
  link?: string;
  linkLabel?: string;
}

const REPORTS: Report[] = [
  { title: 'Batch summary', description: 'All batches with status, yield, planned/actual dates, QA decision and delay flag.', perm: 'batch.view', download: '/batches/export' },
  { title: 'Batch manufacturing record', description: 'Print-ready executed eBMR for a batch (materials, steps, readings, signatures, QC, deviations). Open a batch and choose “Batch record”.', perm: 'batch.view', link: '/production/batches', linkLabel: 'Choose batch' },
  { title: 'Inventory status', description: 'All lots on hand with status, location, expiry and value.', perm: 'inventory.view', download: '/inventory/lots/export' },
  { title: 'Near-expiry inventory', description: 'Lots expiring within 90 days with projected use and recommendations.', perm: 'inventory.view', download: '/analytics/expiry-risk/export' },
  { title: 'Expired stock', description: 'Expired lots still holding quantity.', perm: 'inventory.view', download: '/inventory/lots/export', params: { view: 'expired' } },
  { title: 'Deviation report', description: 'Deviation register with aging, classification, owner and status (use Export on the list).', perm: 'deviation.view', link: '/quality/deviations?view=all', linkLabel: 'Open register' },
  { title: 'CAPA report', description: 'CAPA register with due dates, progress and overdue flags (use Export on the list).', perm: 'capa.view', link: '/quality/capa?view=all', linkLabel: 'Open register' },
  { title: 'OOS report', description: 'OOS investigations with results, phase and conclusion (use Export on the list).', perm: 'oos.view', link: '/quality/oos?view=all', linkLabel: 'Open register' },
  { title: 'QC summary', description: 'QC samples by stage, status and conclusion (use Export on the list).', perm: 'qc.view', link: '/quality/samples', linkLabel: 'Open list' },
  { title: 'Supplier performance', description: 'Supplier scorecards: on-time delivery, QC rejection, lead time, documentation (use Export on the list).', perm: 'supplier.view', link: '/master-data/suppliers', linkLabel: 'Open scorecards' },
  { title: 'Audit trail', description: 'Filtered audit trail export (the export itself is recorded in the audit trail).', perm: 'audit.export', download: '/audit/export' },
];

export default function ReportsPage() {
  const { can } = useAuth();
  const visible = REPORTS.filter((r) => can(r.perm));
  return (
    <>
      <PageHeader title="Reports" description="CSV exports open in Excel (UTF-8, formula-injection safe). The batch record is print-ready — use the browser’s “Save as PDF”. Exports are recorded in the audit trail." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((r) => (
          <Card key={r.title} className="flex flex-col p-4">
            <div className="flex items-center gap-2 font-semibold">
              {r.download ? <FileSpreadsheet className="h-4 w-4 text-primary" /> : <Printer className="h-4 w-4 text-primary" />}
              {r.title}
            </div>
            <p className="mt-1 flex-1 text-[13px] text-muted-foreground">{r.description}</p>
            <div className="mt-3">
              {r.download ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!can('report.export') && r.perm !== 'audit.export'}
                  onClick={async () => {
                    try {
                      await api.download(r.download!, r.params);
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  <Download /> Download CSV
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link href={r.link!}>
                    <ExternalLink /> {r.linkLabel}
                  </Link>
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">XLSX and scheduled PDF reports are on the roadmap; CSV and print-ready views are provided in this release.</p>
    </>
  );
}
