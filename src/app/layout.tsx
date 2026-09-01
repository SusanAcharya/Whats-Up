import type { Metadata, Viewport } from "next";
import { Geist, Syne } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "What's Up",
  description: "News as a group chat. Only the stories you actually care about.",
  applicationName: "What's Up",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "What's Up",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#07040a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${display.variable} h-full`}>
      <body className="h-dvh overflow-hidden bg-background text-foreground antialiased">
        <StoreProvider>
          <PwaRegister />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
