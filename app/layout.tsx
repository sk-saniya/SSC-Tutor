import type { Metadata } from "next";
import { Space_Mono, Manrope, Kalam } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "SSC-Tutor — Class 10 Science & Math Doubt Solver",
  description:
    "Ask any Class 10 NCERT Science or Math question and get a clear, step-by-step answer grounded in your syllabus.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${spaceMono.variable} ${manrope.variable} ${kalam.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
