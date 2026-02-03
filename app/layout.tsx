import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "White Chat",
  description: "Minimal single-page chat layout",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black">{children}</body>
    </html>
  );
}
