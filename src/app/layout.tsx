import type { Metadata } from "next";
import "./globals.css";
import "./connect.css";
import { AppProvider } from "@/context/AppContext";

export const metadata: Metadata = {
  title: "BEMS ERP | Financial Operations",
  description: "BEMS Group multi-subsidiary financial operations, request channels, disbursements and accountability system",
  icons: {
    icon: "/bems-mark.png",
    shortcut: "/bems-mark.png",
    apple: "/bems-mark.png",
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
