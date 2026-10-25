'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginSchema, type LoginInput } from '@pharmodry/validation';
import { Activity, FlaskConical, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { Button, Input, Label } from '@/components/ui/primitives';
import { Logo } from '@/components/shell/logo';

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const DEMO_ACCOUNTS = [
  ['qa.manager@novacure.demo', 'QA Manager'],
  ['qc.analyst@novacure.demo', 'QC Analyst'],
  ['warehouse.officer@novacure.demo', 'Warehouse Officer'],
  ['production.supervisor@novacure.demo', 'Production Supervisor'],
  ['operator@novacure.demo', 'Production Operator'],
  ['planner@novacure.demo', 'Supply Chain Planner'],
  ['plant.manager@novacure.demo', 'Plant Manager'],
  ['company.admin@novacure.demo', 'Company Admin'],
];

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = React.useState<string | null>(params.get('expired') ? 'Your session expired. Please sign in again.' : null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  React.useEffect(() => {
    if (!loading && user) router.replace(params.get('next') || '/');
  }, [loading, user, router, params]);

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await login(v.email, v.password);
      router.replace(params.get('next') || '/');
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-navy p-10 text-white lg:flex">
        <div className="absolute inset-0 opacity-[0.22]" style={{ backgroundImage: 'radial-gradient(circle at 18% 18%, #1F4FCC 0, transparent 42%), radial-gradient(circle at 82% 72%, #13B5C7 0, transparent 34%)' }} />
        <div className="relative">
          <Logo inverted />
        </div>
        <div className="relative max-w-lg space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-cyan-bright">Precision in Every Batch.</p>
          <h1 className="text-3xl font-semibold leading-tight">Operations, quality and compliance intelligence for pharmaceutical manufacturers.</h1>
          <ul className="space-y-3 text-[15px] text-[#DCE6F7]">
            <li className="flex gap-3"><Activity className="mt-0.5 h-5 w-5 text-brand-cyan-bright" /> Exception-driven Command Center: what needs attention, why, and who owns it.</li>
            <li className="flex gap-3"><FlaskConical className="mt-0.5 h-5 w-5 text-brand-cyan-bright" /> Lot-level traceability from GRN through QC, QA release, eBMR and finished goods.</li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-brand-cyan-bright" /> Audit trail, electronic signatures and server-enforced GMP rules.</li>
            <li className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 text-brand-cyan-bright" /> Assistive AI Copilot — humans make every regulated decision.</li>
          </ul>
        </div>
        <p className="relative text-xs text-[#A9BBD9]">Technical controls support validated processes; use of the software alone does not establish GMP compliance.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use your company account.</p>
          </div>
          {DEMO && <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">Demonstration environment — all companies, people and records are fictional.</div>}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" aria-invalid={!!form.formState.errors.email} {...form.register('email')} />
              {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!form.formState.errors.password} {...form.register('password')} />
              {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              Sign in
            </Button>
          </form>
          {DEMO && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Demo accounts (click to fill email; password per DEMO_DATA_GUIDE)</p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map(([email, role]) => (
                  <button key={email} type="button" onClick={() => form.setValue('email', email)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-secondary">
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
