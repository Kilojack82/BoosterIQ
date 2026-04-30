import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BoosterIQ',
  description: 'Concession and volunteer intelligence for booster clubs',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
