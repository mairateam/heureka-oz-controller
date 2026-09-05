import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Heureka OZ Controller — MAIRA",
  description: "Prehled spokojenosti klientu na Heurece CZ a SK.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={display.className}>
      <body>
        <header className="topbar">
          <div className="topbar__inner">
            <Link href="/" className="brand">
              <span className="brand__mark" aria-hidden />
              Heureka OZ Controller
            </Link>
            <nav className="nav">
              <Link href="/">Přehled</Link>
              <Link href="/historie">Historie</Link>
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
