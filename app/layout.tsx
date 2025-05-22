import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ご飯当番チェッカー',
  description: '兄弟3人でのご飯当番を管理するアプリ',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
} 