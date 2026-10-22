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
      { url: "/bems-mark.png?v=2", type: "image/png" },
      { url: "/favicon.ico?v=2" },
    ],
    shortcut: "/bems-mark.png?v=2",
    apple: "/bems-mark.png?v=2",
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
