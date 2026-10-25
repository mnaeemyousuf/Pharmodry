/**
 * Design tokens shared between the web app and print/report views.
 * Status tones are semantic so every module renders the same status the same way.
 */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'progress' | 'muted';
export declare const STATUS_TONES: Record<string, Tone>;
export declare function toneFor(status: string | null | undefined): Tone;
export declare function humanize(value: string | null | undefined): string;
