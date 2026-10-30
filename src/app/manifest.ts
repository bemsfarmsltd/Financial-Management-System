import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BEMS Attendance Kiosk',
    short_name: 'BEMS Kiosk',
    description: 'BEMS Group Reception & Dynamic Attendance Presence Kiosk System',
    id: '/attendance/kiosk',
    start_url: '/attendance/kiosk',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#10b981',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
