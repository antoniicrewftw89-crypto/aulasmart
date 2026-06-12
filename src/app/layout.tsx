import type { Metadata } from "next";
import { Baloo_2, Caveat } from "next/font/google";
import "./globals.css";

// Tipografía de herramienta creativa, no de chat de IA:
// Baloo 2 (redonda, amable) para la UI · Caveat (manuscrita) para acentos.
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "AulaSmart",
  description: "Tu mesa de estudio: árboles de ideas en stickies. Tú piensas; la IA solo viene si la llamas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${baloo.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
