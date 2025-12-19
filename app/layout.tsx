import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ReactNode } from "react";

// The new font 'Fira Code' is imported directly in globals.css.
// Setting a default theme here ensures the dark, "lucky" theme is the default.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
