import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // "Blanco editorial": chrome blanco y lienzo apenas gris.
        // Tres niveles de profundidad:
        //   canvas  → el fondo sobre el que descansa el contenido
        //   paper   → chrome (header, nav, riel)
        //   surface → la nota en sí — sobre blanco flota con borde + sombra
        canvas:   '#F5F5F3',
        paper:    '#FFFFFF',
        surface:  '#FFFFFF',
        ink:      '#1B1917',      // near-black neutro (el cálido peleaba con el blanco)
        muted:    '#75716B',
        divider:  '#E7E6E2',
        subtle:   '#F1F1EE',

        brand: {
          DEFAULT: '#B91C1C',     // rojo del cliente — solo acciones críticas
          dark:    '#8F1414',
          soft:    '#F3E1E1',
        },
        approve: {
          DEFAULT: '#1F5940',     // forest green — aprobado, publicado
          soft:    '#DDECE4',
        },
        pending: {
          DEFAULT: '#C87F17',     // amber calibrado — pendiente de cierre
          soft:    '#F5E9D2',
        },
        schedule: {
          DEFAULT: '#163A6C',     // azul institucional — programado
          soft:    '#DFE5F0',
        },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans:    ['var(--font-instrument)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Escala editorial (con line-height ajustado)
        'micro':    ['11px', { lineHeight: '1.3', letterSpacing: '0.08em' }],
        'label':    ['12px', { lineHeight: '1.4', letterSpacing: '0.06em' }],
        'meta':     ['13px', { lineHeight: '1.5' }],
        'body':     ['15px', { lineHeight: '1.55' }],
        'lead':     ['17px', { lineHeight: '1.5' }],
        'headline': ['24px', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        'title':    ['32px', { lineHeight: '1.1',  letterSpacing: '-0.02em' }],
        'display':  ['44px', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
      },
      // Sombras más generosas y radios más suaves (3-5px → 8-12px):
      // el cambio más barato con más impacto en que se lea "producto".
      boxShadow: {
        card:      '0 1px 2px rgba(27, 25, 23, 0.05)',
        cardHover: '0 2px 8px -2px rgba(27, 25, 23, 0.08), 0 1px 2px rgba(27, 25, 23, 0.05)',
        elevated:  '0 12px 32px -8px rgba(27, 25, 23, 0.14), 0 2px 8px -2px rgba(27, 25, 23, 0.06)',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'stroke-down': {
          from: { transform: 'scaleY(0)' },
          to: { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'fade-in':    'fade-in 240ms ease-out',
        'slide-up':   'slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'stroke-down':'stroke-down 220ms cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
