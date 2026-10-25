'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Send, Sparkles, ThumbsDown, ThumbsUp, Bot, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { CopilotAnswer } from '@/lib/types';
import { Button, Card, Textarea } from '@/components/ui/primitives';
import { Callout, PageHeader } from '@/components/page';

const SUGGESTIONS = [
  'What is happening across my operation right now?',
  'Which batches are currently delayed?',
  'Which CAPAs are overdue?',
  'Why did production plan achievement fall this month?',
  'Which raw materials are at risk of stockout?',
  'Which suppliers have the highest rejection rate?',
  'Show deviations related to compression during the last six months.',
  'What inventory is near expiry?',
];

/** Minimal, safe markdown: **bold**, bullets, paragraphs. No HTML injection. */
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const inline = (s: string, key: number) => (
    <React.Fragment key={key}>
      {s.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part))}
    </React.Fragment>
  );
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`l${out.length}`} className="my-1.5 list-disc space-y-1 pl-5">
          {list.map((l, i) => (
            <li key={i}>{inline(l, i)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((l, i) => {
    const m = /^\s*[-*•]\s+(.*)$/.exec(l) ?? /^\s*\d+\.\s+(.*)$/.exec(l);
    if (m) list.push(m[1]);
    else {
      flush();
      if (l.trim()) out.push(<p key={i} className="my-1.5">{inline(l.replace(/^#+\s*/, ''), i)}</p>);
    }
  });
  flush();
  return <div className="text-[13.5px] leading-relaxed">{out}</div>;
}

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  answer?: CopilotAnswer;
  rating?: 'UP' | 'DOWN';
}

function CopilotInner() {
  const params = useSearchParams();
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | undefined>();
  const { data: status } = useQuery({ queryKey: ['ai-status'], queryFn: () => api.get<{ configured: boolean; model: string | null }>('/ai/status') });
  const endRef = React.useRef<HTMLDivElement>(null);
  const asked = React.useRef(false);

  const ask = React.useCallback(
    async (q: string) => {
      if (!q.trim() || busy) return;
      setInput('');
      setMessages((m) => [...m, { role: 'user', text: q }]);
      setBusy(true);
      try {
        const a = await api.post<CopilotAnswer>('/ai/copilot/ask', { question: q, conversationId });
        setConversationId(a.conversationId);
        setMessages((m) => [...m, { role: 'assistant', text: a.answer, answer: a }]);
      } catch (e) {
        setMessages((m) => [...m, { role: 'assistant', text: `⚠️ ${errorMessage(e)}` }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId],
  );

  React.useEffect(() => {
    const q = params.get('q');
    if (q && !asked.current) {
      asked.current = true;
      void ask(q);
    }
  }, [params, ask]);
  // Block body: newer browsers return a Promise from scrollIntoView, which React must not receive as a cleanup.
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const rate = async (idx: number, rating: 'UP' | 'DOWN') => {
    const m = messages[idx];
    if (!m.answer) return;
    try {
      await api.post(`/ai/messages/${m.answer.messageId}/feedback`, { rating });
      setMessages((all) => all.map((x, i) => (i === idx ? { ...x, rating } : x)));
      toast.success('Thanks for the feedback');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-progress" /> Pharmodry Copilot</span>} description="Ask about batches, quality events, inventory and suppliers. Figures are computed by Pharmodry from live records; the AI model only explains them. The Copilot cannot approve, release or change any record." />
      {status && !status.configured && (
        <div className="mb-4">
          <Callout tone="warning" title="AI provider not configured">
            The server has no MISTRAL_API_KEY, so answers show the computed facts and record links only (no AI-written explanation). An administrator can enable Mistral in the API environment configuration.
          </Callout>
        </div>
      )}
      <Card className="flex h-[calc(100vh-260px)] min-h-[420px] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5" data-testid="copilot-messages">
          {messages.length === 0 && (
            <div className="mx-auto max-w-2xl py-6 text-center">
              <Bot className="mx-auto h-10 w-10 text-progress" />
              <p className="mt-3 text-sm text-muted-foreground">Try one of these questions:</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-full border px-3 py-1.5 text-[13px] hover:border-progress/50 hover:bg-progress/5">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-lg px-4 py-3', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'border bg-card')}>
                {m.role === 'assistant' && m.answer && (
                  <div className={cn('mb-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', m.answer.aiGenerated ? 'border-progress/30 bg-progress/10 text-progress' : 'border-border bg-secondary text-muted-foreground')}>
                    {m.answer.aiGenerated ? <Sparkles className="h-3 w-3" /> : <Calculator className="h-3 w-3" />}
                    {m.answer.label}
                  </div>
                )}
                {m.role === 'assistant' ? <Markdown text={m.text} /> : <div className="text-[13.5px]">{m.text}</div>}
                {m.answer && m.answer.citations.length > 0 && (
                  <div className="mt-3 border-t pt-2">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sources ({m.answer.citations.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.answer.citations.slice(0, 15).map((c) => (
                        <Link key={`${c.type}-${c.id}`} href={c.href} className="rounded-md border bg-secondary px-2 py-0.5 text-[11.5px] font-medium hover:border-primary/50">
                          {c.type}: {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {m.answer && (
                  <div className="mt-2 flex items-center gap-1 text-muted-foreground">
                    <span className="mr-1 text-[11px]">Helpful?</span>
                    <Button variant="ghost" size="icon" className={cn('h-7 w-7', m.rating === 'UP' && 'text-success')} onClick={() => rate(i, 'UP')} aria-label="Thumbs up">
                      <ThumbsUp />
                    </Button>
                    <Button variant="ghost" size="icon" className={cn('h-7 w-7', m.rating === 'DOWN' && 'text-danger')} onClick={() => rate(i, 'DOWN')} aria-label="Thumbs down">
                      <ThumbsDown />
                    </Button>
                    {m.answer.model && <span className="ml-auto text-[11px]">model: {m.answer.model}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-sm text-muted-foreground">Retrieving records and computing facts…</div>}
          <div ref={endRef} />
        </div>
        <form
          className="flex gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            placeholder="Ask a question about your operation…"
            rows={1}
            className="min-h-[40px] resize-none"
            aria-label="Question"
          />
          <Button type="submit" loading={busy} disabled={!input.trim()} aria-label="Send">
            <Send />
          </Button>
        </form>
      </Card>
    </>
  );
}

export default function CopilotPage() {
  return (
    <Suspense>
      <CopilotInner />
    </Suspense>
  );
}
