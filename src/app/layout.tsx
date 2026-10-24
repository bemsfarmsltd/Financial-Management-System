import type { Metadata } from "next";
import "./globals.css";
import "./connect.css";
import { AppProvider } from "@/context/AppContext";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: "BEMS ERP | Financial Operations",
  description: "BEMS Group multi-subsidiary financial operations, request channels, disbursements and accountability system",
  icons: {
    icon: [
      { url: "/bems-group-logo.png?v=20261024", type: "image/png" },
      { url: "/favicon.ico?v=20261024" },
    ],
    shortcut: "/bems-group-logo.png?v=20261024",
    apple: "/bems-group-logo.png?v=20261024",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
