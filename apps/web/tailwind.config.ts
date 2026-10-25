import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const v = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Pharmodry brand palette (fixed values; UI roles use the tokens below)
        brand: { navy: '#0B1E3F', cobalt: '#1F4FCC', 'cobalt-deep': '#1A3FA6', cyan: '#0B93A3', 'cyan-bright': '#13B5C7', mist: '#EAF0FC', slate: '#52607A' },
        border: v('border'),
        input: v('input'),
        ring: v('ring'),
        background: v('background'),
        foreground: v('foreground'),
        primary: { DEFAULT: v('primary'), foreground: v('primary-foreground') },
        secondary: { DEFAULT: v('secondary'), foreground: v('secondary-foreground') },
        muted: { DEFAULT: v('muted'), foreground: v('muted-foreground') },
        accent: { DEFAULT: v('accent'), foreground: v('accent-foreground') },
        destructive: { DEFAULT: v('destructive'), foreground: v('destructive-foreground') },
        card: { DEFAULT: v('card'), foreground: v('card-foreground') },
        popover: { DEFAULT: v('popover'), foreground: v('popover-foreground') },
        sidebar: { DEFAULT: v('sidebar'), foreground: v('sidebar-foreground'), muted: v('sidebar-muted'), active: v('sidebar-active') },
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        info: v('info'),
        progress: v('progress'),
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'], mono: ['var(--font-mono)', 'ui-monospace', 'monospace'] },
    },
  },
  plugins: [animate],
} satisfies Config;
