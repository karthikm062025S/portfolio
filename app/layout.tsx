import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { identity } from "./content";
import "./globals.css";

const hedvig = localFont({
  src: "../public/fonts/hedvig-letters-serif/HedvigLettersSerif-opsz.ttf",
  weight: "400",
  variable: "--font-serif",
  adjustFontFallback: "Times New Roman",
});

const schibsted = localFont({
  src: "../public/fonts/schibsted-grotesk/SchibstedGrotesk-wght.woff2",
  weight: "400 900",
  variable: "--font-sans",
});

const commitMono = localFont({
  src: "../public/fonts/commit-mono/CommitMono-400-Regular.otf",
  weight: "400",
  variable: "--font-mono",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: identity.name,
  description: identity.description,
  openGraph: {
    title: identity.name,
    description: identity.description,
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: identity.name }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8ede7" },
    { media: "(prefers-color-scheme: dark)", color: "#232b24" },
  ],
};

// Runs before first paint: applies a saved theme (no flash) and marks JS as available. On DOMContentLoaded it
// matches the browser bar to the ground and starts the section-head reveal, so neither waits for hydration.
const boot = `(function(){var r=document.documentElement;try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')r.dataset.theme=t}catch(e){}if(!('IntersectionObserver'in window))return;r.classList.add('js');document.addEventListener('DOMContentLoaded',function(){var c=getComputedStyle(r).getPropertyValue('--ground').trim();if(c)document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.content=c});var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -10% 0px'});document.querySelectorAll('.reveal').forEach(function(el){io.observe(el)})})})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hedvig.variable} ${schibsted.variable} ${commitMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
