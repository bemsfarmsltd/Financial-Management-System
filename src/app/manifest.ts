import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BEMS Attendance Kiosk',
    short_name: 'BEMS Kiosk',
    description: 'BEMS Group Reception & Dynamic Attendance Presence Kiosk System',
    start_url: '/attendance/kiosk',
    scope: '/attendance/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#10b981',
    icons: [
      {
        src: '/bems-mark.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/bems-mark.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
