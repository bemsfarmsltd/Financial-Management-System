import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#090d16',
};

export const metadata: Metadata = {
  title: 'BEMS GMD Copilot',
  description: 'Executive AI Mobile Cockpit for BEMS Group Managing Director',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GMD Copilot',
  },
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <div className="gmd-mobile-shell">{children}</div>;
}
