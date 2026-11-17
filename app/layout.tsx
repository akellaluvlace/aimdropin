import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./motion.css";
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

// The labels, tabs and buttons are set in this font, so the stand-in shown
// before it loads has to take the same room. JetBrains Mono is 0.6em per
// character; so are Menlo (Apple), Lucida Console and Courier New (Windows)
// and the default monospace on Android and Linux. Next's automatic fallback
// is a stretched Arial, whose capitals ran up to 28% wider and made whole rows
// re-wrap, and the page jump, when the real font arrived.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Menlo", "Lucida Console", "Courier New", "monospace"],
});


export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Akella inMotion", url: "https://akellainmotion.com" }],
  creator: "Akella inMotion",
  publisher: "Akella inMotion",
  keywords: [
    "vibecoding",
    "AI code preview",
    "HTML preview",
    "JSX preview",
    "live code playground",
    "no-install code editor",
    "Tailwind preview",
    "landing page templates",
    "AiM Dropin",
    "Akella inMotion",
  ],
  category: "technology",
  // No canonical here, for the same reason as og:url below: a page that
  // doesn't set its own would tell search engines it is a copy of the home
  // page. Each indexable page names itself.
  //
  // No icons here either: the tab icon and the Apple touch icon are the
  // files next to this one (favicon.ico, icon.png, apple-icon.png) and Next
  // writes their link tags itself. An icons entry here would switch
  // icon.png and apple-icon.png off.
  //
  // No og:url here: a page without its own would otherwise claim to be the
  // home page when someone shares it.
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F1EA",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <body className="bg-paper text-ink">{children}</body>
    </html>
  );
}
