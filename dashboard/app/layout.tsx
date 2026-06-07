import type { Metadata } from "next";
import { Chakra_Petch, JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// Tactical display (guardian/console character) + instrument mono + refined body.
// Deliberately NOT the generic Inter/Roboto/Space-Grotesk set.
const display = Chakra_Petch({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});
const mono = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});
const sans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "SENTINEL — autonomous BNB-Chain trader you can let run",
  description:
    "Live command console for SENTINEL: the AI proposes, a deterministic kernel decides, Trust Wallet signs, and the agent learns — bounded and verifiable on-chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${sans.variable}`}>
      <body className="bg-console grain font-sans text-bone antialiased">{children}</body>
    </html>
  );
}
