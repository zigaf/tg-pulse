import type { Metadata } from 'next';
import { Inter, Unbounded } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-unbounded',
  weight: ['400', '600', '800'],
});

export const metadata: Metadata = {
  title: 'TGPulse — откуда приходят подписчики и деньги в ваш Telegram-канал',
  description:
    'Точная атрибуция подписчиков, конверсии в Яндекс.Директ и Telegram Ads, ROMI по источникам. Веб-дашборд вместо Excel.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${unbounded.variable}`}>
      <body>{children}</body>
    </html>
  );
}
