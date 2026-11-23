import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE_NAME, resolveAppLocale, type AppLocale } from '@/shared/i18n/config';
import { I18nProvider } from '@/shared/i18n/I18nContext';
import { translateApp } from '@/shared/i18n/translator';
import './globals.css';

async function readInitialLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  return resolveAppLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await readInitialLocale();
  return {
    title: translateApp(locale, 'app.title'),
    description: translateApp(locale, 'app.description'),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = await readInitialLocale();

  return (
    <html lang={initialLocale}>
      <body className="min-h-screen bg-[#EEF2F6] text-slate-900 antialiased">
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
