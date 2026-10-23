import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { StoreBadge } from "@/components/shell/store-badge";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@xyflow/react/dist/style.css";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Data Flow Explorer", template: "%s · Data Flow Explorer" },
  description: "How the ten tables join, where the keys break, and which checks watch each handoff.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <div className="flex h-full">
              <AppSidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b px-4">
                  <Suspense fallback={<span className="text-xs text-muted-foreground">reading store…</span>}>
                    <StoreBadge />
                  </Suspense>
                  <ThemeToggle />
                </header>
                <main className="flex min-h-0 flex-1 flex-col">{children}</main>
              </div>
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
