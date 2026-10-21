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
      { url: "/favicon.ico" },
      { url: "/bems-mark.png", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
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
      <head>
        <title>BEMS ERP | Financial Operations</title>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/bems-mark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/bems-mark.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.title = "BEMS ERP | Financial Operations";`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen">
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
