import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });
const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'TGPulse — откуда приходят подписчики и деньги в ваш Telegram-канал',
  description:
    'Точная атрибуция подписчиков, конверсии в Яндекс.Директ и Telegram Ads, ROMI по источникам. Веб-дашборд вместо Excel.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
