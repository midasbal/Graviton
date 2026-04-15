import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Web3Provider from "@/providers/Web3Provider";
import ToastContainer from "@/components/layout/ToastContainer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Graviton — AI Agent Marketplace on 0G",
  description:
    "Mint, trade, rent, and test-drive AI agents as ERC-7857 Intelligent NFTs. Powered by 0G decentralized storage, TEE-sealed inference, and on-chain governance.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Graviton — AI Agent Marketplace on 0G",
    description:
      "The decentralized marketplace for AI agents. ERC-7857 INFTs with encrypted weights, TEE verification, and revenue-sharing DAO.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Graviton — AI Agent Marketplace on 0G",
    description:
      "Mint, trade, rent, and test-drive AI agents as ERC-7857 Intelligent NFTs on 0G Chain.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Web3Provider>
          {/* Checkpoint banner */}
          <div className="w-full bg-yellow-500/10 border-b border-yellow-500/30 text-center py-2 px-4 text-sm text-yellow-300">
            🚧 <strong>Checkpoint Notice:</strong> This project is currently in active development.
            This is a submission for the HackQuest Checkpoint phase and the project will be fully
            completed for the final deadline.
          </div>
          {children}
          <ToastContainer />
        </Web3Provider>
      </body>
    </html>
  );
}
