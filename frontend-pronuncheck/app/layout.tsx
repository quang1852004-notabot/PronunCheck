import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/app/contexts/AuthContext";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import Pwa from "@/app/Pwa";

// Tat static prerendering - Firebase can browser APIs nen khong the chay server-side
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#4CAF50",
};

export const metadata: Metadata = {
  title: "PronunCheck - Luyen Phat Am",
  description: "Ung dung kiem tra phat am tieng Duc cho hoc sinh",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <AuthProvider>
            <Pwa />
            {children}
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
