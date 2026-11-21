import "./globals.css";
export const metadata = {
  title: "Azad: a chat terminal for Solana memecoins",
  description: "Find new Solana launches, check them on-chain, and sign the swap in your own wallet.",
};
export const viewport = { themeColor: "#0c0d0e", viewportFit: "cover" as const };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
