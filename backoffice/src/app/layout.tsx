import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Fraunces, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { CurrentDate } from '@/components/CurrentDate';
import { NavTabs } from '@/components/NavTabs';
import { UserMenu } from '@/components/UserMenu';
import { DeferredGuard } from '@/components/DeferredGuard';
import { getSessionUser } from '@/lib/currentUser';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
  // sin `weight` → Next descarga la variable font completa (100-900)
});

const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
  weight: ['400', '500', '600'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Mesa de edición — PaginaUno.Do',
  description: 'Sistema editorial de aprobación · PaginaUno.Do',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionUser();
  return (
    <html lang="es" className={`${fraunces.variable} ${instrument.variable} ${mono.variable} h-full`}>
      {/* El escritorio de triage es un split-pane que llena la ventana: el body
          es una columna flex y <main> el único elemento que scrollea. */}
      <body className="flex h-full flex-col overflow-hidden">
        {/* Header en UNA banda: marca + navegación + reloj en 56px.
            El nav ya no necesita banda propia — los tabs píldora conviven. */}
        <header className="flex h-14 flex-none items-center gap-5 border-b border-divider bg-paper px-5">
          <Link href="/" className="flex flex-none items-baseline gap-2.5">
            <span className="font-display text-lead font-semibold leading-none text-ink">
              Pagina<span className="text-brand">Uno</span>
              <span className="font-mono text-label font-normal text-muted">.do</span>
            </span>
            <span className="hidden text-micro uppercase tracking-wider text-muted lg:inline">
              Mesa de edición
            </span>
          </Link>
          <Suspense fallback={<div className="flex-1" />}>
            <NavTabs />
          </Suspense>
          <CurrentDate />
          <UserMenu user={session?.name ?? ''} isAdmin={session?.role === 'admin'} />
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <DeferredGuard />
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            className: 'font-sans',
          }}
        />
      </body>
    </html>
  );
}
