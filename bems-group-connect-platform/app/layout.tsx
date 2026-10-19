import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bems Group Connect | Client Workspace',
  description: 'Connect your business systems once and serve customers across every channel.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
