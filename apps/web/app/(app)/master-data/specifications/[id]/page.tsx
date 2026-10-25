'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { describeSpec } from '@pharmodry/types';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/utils';
import type { Spec } from '@/lib/types';
import { Skeleton } from '@/components/ui/primitives';
import { AuditHistory, DetailHeader, Section } from '@/components/page';
import { VersionHistory } from '@/components/versions';

export default function SpecDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: s } = useQuery({ queryKey: ['spec', id], queryFn: () => api.get<Spec>(`/specifications/${id}`) });
  if (!s) return <Skeleton className="h-96" />;
  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Specifications', href: '/master-data/specifications' }, { label: `${s.code} v${s.version}` }]}
        title={`${s.code} v${s.version}`}
        status={s.status}
        subtitle={s.name}
        meta={[
          { label: 'Stage', value: s.stage.replace(/_/g, ' ').toLowerCase() },
          { label: 'Tests', value: s.tests.length },
          { label: 'Created', value: fmtDate(s.createdAt) },
        ]}
      />
      <Section title="Tests">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2">#</th>
              <th className="py-2">Test</th>
              <th className="py-2">Result type</th>
              <th className="py-2">Acceptance criterion</th>
              <th className="py-2">Mandatory</th>
            </tr>
          </thead>
          <tbody>
            {s.tests.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2">{t.sequence}</td>
                <td className="py-2 font-medium">{t.name}</td>
                <td className="py-2">{t.resultType.replace('_', '/').toLowerCase()}</td>
                <td className="py-2">{describeSpec({ ...t, minValue: t.minValue ?? null, maxValue: t.maxValue ?? null })}</td>
                <td className="py-2">{t.isMandatory ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Section title="Version history">
          <VersionHistory entityType="QcSpecification" entityId={s.id} />
        </Section>
        <Section title="Audit trail">
          <AuditHistory entityId={s.id} />
        </Section>
      </div>
    </>
  );
}
