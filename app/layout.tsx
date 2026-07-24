import './globals.css';
import type { Metadata, Viewport } from 'next';
import PWARegister from '@/components/PWARegister';

export const metadata: Metadata = {
  title: 'CSKA KAZ · Админ-панель',
  description: 'Панель управления приложением CSKA KAZ',
  manifest: '/manifest.webmanifest',
  applicationName: 'CSKA Admin',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CSKA Admin' },
  icons: {
    icon: '/favicon.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A1628',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
