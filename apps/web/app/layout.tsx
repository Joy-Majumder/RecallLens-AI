import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RecallLens",
  description:
    "Recall verification for the unit in your hand. Read lot codes from photos and check against official recall data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}