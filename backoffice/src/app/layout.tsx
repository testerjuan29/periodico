import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'El Periódico — Backoffice',
  description: 'Aprobación de publicaciones generadas por IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-serif text-2xl font-bold">
              EL <span className="text-brand">PERIÓDICO</span>
              <span className="ml-3 text-sm font-normal text-gray-500">Backoffice</span>
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="text-gray-700 hover:text-brand">Pendientes</Link>
              <Link href="/?status=scheduled" className="text-gray-700 hover:text-brand">Programadas</Link>
              <Link href="/?status=published" className="text-gray-700 hover:text-brand">Publicadas</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
