import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "NovaCard — Danh tính số B2B", description: "Danh thiếp số chuyên nghiệp cho kết nối B2B." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="vi" suppressHydrationWarning><body>{children}</body></html>;
}
