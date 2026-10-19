import type { Metadata } from "next";
import "./globals.css";
import "./connect.css";
import { AppProvider } from "@/context/AppContext";

export const metadata: Metadata = {
  title: "BEMS Group — Enterprise Expenditure, Payroll & Accountability Management",
  description: "BEMS Group multi-subsidiary financial operations, request channels, disbursements and accountability system",
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
