import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { buildThemeInitScript } from '@/lib/portable/theme-mode';
import { LOCALE_COOKIE_NAME, resolveAppLocale, type AppLocale } from '@/shared/i18n/config';
import { I18nProvider } from '@/shared/i18n/I18nContext';
import { translateApp } from '@/shared/i18n/translator';
import { APP_THEME_STORAGE_KEY, DEFAULT_APP_THEME_MODE } from '@/shared/theme/config';
import { ThemeProvider } from '@/shared/theme/ThemeContext';
import './globals.css';

const THEME_INIT_SCRIPT = buildThemeInitScript({
  storageKey: APP_THEME_STORAGE_KEY,
  defaultMode: DEFAULT_APP_THEME_MODE,
});

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
    <html lang={initialLocale} data-theme="precision-grid" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-[var(--pg-canvas)] text-[var(--pg-text)] antialiased">
        <ThemeProvider>
          <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
