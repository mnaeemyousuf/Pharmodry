'use client';

/**
 * Chart primitives following the dataviz method: thin marks, rounded data-ends anchored to the
 * baseline, recessive grid, one y-axis, legend for ≥ 2 series, hover tooltips, text in ink tokens.
 */
import * as React from 'react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtNum } from '@/lib/utils';

const axis = { stroke: 'var(--chart-axis)', fontSize: 11, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold text-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-foreground">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular">
            {fmtNum(p.value, 1)}
            {unit ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
  type?: 'bar' | 'line' | 'area';
  stack?: string;
}

export function ComboChart({ data, x, series, unit, height = 240, band, onClick, yDomain }: { data: Record<string, unknown>[]; x: string; series: SeriesDef[]; unit?: string; height?: number; band?: [number, number]; onClick?: (row: Record<string, unknown>) => void; yDomain?: [number | string, number | string] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={2} barCategoryGap="28%" onClick={(e) => onClick && e?.activePayload?.[0] && onClick(e.activePayload[0].payload)}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey={x} {...axis} />
        <YAxis {...axis} width={56} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${fmtNum(v / 1000, 0)}k` : fmtNum(v, 1))} domain={yDomain} />
        {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="var(--seq-250)" fillOpacity={0.15} stroke="none" ifOverflow="extendDomain" />}
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
        {series.length > 1 && <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 12, color: 'var(--chart-axis)' }} />}
        {series.map((s) =>
          s.type === 'line' ? (
            <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))', fill: s.color }} activeDot={{ r: 5 }} />
          ) : s.type === 'area' ? (
            <Area key={s.key} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.12} strokeWidth={2} />
          ) : (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={s.stack} radius={s.stack ? 0 : [4, 4, 0, 0]} stroke="hsl(var(--card))" strokeWidth={s.stack ? 2 : 0} maxBarSize={40} cursor={onClick ? 'pointer' : undefined} />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Horizontal single-series bar list (category names are long). */
export function HBar({ data, label, value, color = 'var(--series-1)', unit, height }: { data: Record<string, unknown>[]; label: string; value: string; color?: string; unit?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(120, data.length * 34 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis type="number" {...axis} />
        <YAxis type="category" dataKey={label} {...axis} width={150} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
        <Bar dataKey={value} name={value} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fontSize: 11, fill: 'var(--chart-axis)', formatter: (v: number) => `${fmtNum(v, 1)}${unit ?? ''}` }} />
      </BarChart>
    </ResponsiveContainer>
  );
}
