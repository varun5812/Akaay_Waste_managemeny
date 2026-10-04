import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Waste Management Intelligence System (WMIS) | Municipal AI Platform",
  description: "Smart Environmental Governance, AI Citizen Assistant, and Public Sanitation Dispatch Command.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>{children}</body>
    </html>
  );
}
