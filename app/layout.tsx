import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Azad: a chat terminal for Solana memecoins",
  description: "Find new Solana launches, check them on-chain, and sign the swap in your own wallet.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0c0d0e", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
