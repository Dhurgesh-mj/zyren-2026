import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "EventIQ Secure | Cybersecurity-Driven Event Management",
  description: "Secure Events • Verified Attendance • Smarter Campuses. A centralized platform for college event management with JWT authentication, QR-based attendance, and RBAC access control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
