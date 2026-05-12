import type { Metadata } from 'next';
import { Bebas_Neue } from 'next/font/google';
import './globals.css';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bebas-neue',
});

export const metadata: Metadata = {
  title: 'BoosterIQ',
  description: 'Concession and volunteer intelligence for booster clubs',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={bebasNeue.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
