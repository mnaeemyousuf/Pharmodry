'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/utils';
import { Card } from '@/components/ui/primitives';
import { Callout, PageHeader, Section } from '@/components/page';

interface Usage {
  last30Days: number;
  llmAnswers: number;
  feedback: Record<string, number>;
  recent: { id: string; intent: string; provider?: string; model?: string; latencyMs?: number; createdAt: string; conversation: { feature: string } }[];
}

export default function AiGovernancePage() {
  const { data: status } = useQuery({ queryKey: ['ai-status'], queryFn: () => api.get<{ configured: boolean; provider: string | null; model: string | null }>('/ai/status') });
  const { data } = useQuery({ queryKey: ['ai-usage'], queryFn: () => api.get<Usage>('/ai/usage') });
  return (
    <>
      <PageHeader title="AI governance" description="Every Copilot answer is logged with user, intent, record references, model, latency and feedback. Retention and prompt storage are configured under Organisation → Policies." />
      <div className="mb-4">
        {status?.configured ? (
          <Callout tone="success" title={`Provider: ${status.provider} (${status.model})`}>
            The API key is held server-side only and is never sent to browsers.
          </Callout>
        ) : (
          <Callout tone="warning" title="No AI provider configured">
            Set MISTRAL_API_KEY (and optionally MISTRAL_MODEL) in the API environment. Until then the Copilot returns computed facts without AI explanations, and AI drafting features are unavailable.
          </Callout>
        )}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Answers (30 days)', data?.last30Days ?? 0],
          ['LLM-generated', data?.llmAnswers ?? 0],
          ['Thumbs up', data?.feedback.UP ?? 0],
          ['Thumbs down', data?.feedback.DOWN ?? 0],
        ].map(([l, v]) => (
          <Card key={l as string} className="p-3">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="mt-1 text-2xl font-semibold">{v}</div>
          </Card>
        ))}
      </div>
      <Section title="Recent AI activity">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2">When</th>
              <th className="py-2">Feature</th>
              <th className="py-2">Intent</th>
              <th className="py-2">Provider / model</th>
              <th className="py-2 text-right">Latency</th>
            </tr>
          </thead>
          <tbody>
            {data?.recent.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="py-2">{fmtDateTime(m.createdAt)}</td>
                <td className="py-2">{m.conversation.feature}</td>
                <td className="py-2">{m.intent}</td>
                <td className="py-2">{m.provider ? `${m.provider} / ${m.model}` : 'computed facts only'}</td>
                <td className="py-2 text-right tabular">{m.latencyMs ?? '—'} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
