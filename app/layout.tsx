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
  metadataBase: new URL("https://karthikmandli.vercel.app"),
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

// Runs before first paint: applies a saved theme (no flash) and marks JS as available. Once the DOM is parsed (now, or on
// DOMContentLoaded, with load as a backstop) it matches the browser bar to the ground and reveals the blocks: the ones already
// in view directly (an observer's first notification can wait for a frame that never comes), the rest through an
// IntersectionObserver that also reveals every block above the one entering, so a fast flick or an anchor jump never leaves one hidden.
// It also docks the name into the nav (html.docked) once the hero name has scrolled under the nav.
const boot = `(function(){var r=document.documentElement;try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')r.dataset.theme=t}catch(e){}if(!('IntersectionObserver'in window))return;r.classList.add('js');var done=false;function go(){if(done)return;done=true;var c=getComputedStyle(r).getPropertyValue('--ground').trim();if(c)document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.content=c});var all=document.querySelectorAll('.reveal');var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)for(var i=0;i<all.length;i++){all[i].classList.add('in');io.unobserve(all[i]);if(all[i]===e.target)break}})},{rootMargin:'0px 0px -10% 0px'});all.forEach(function(el){if(el.getBoundingClientRect().top<innerHeight*.9)el.classList.add('in');else io.observe(el)});var h=document.querySelector('.name');if(h)new IntersectionObserver(function(es){var e=es[es.length-1];r.classList.toggle('docked',!e.isIntersecting&&e.boundingClientRect.top<80)},{rootMargin:'-56px 0px 0px 0px'}).observe(h)}if(document.readyState!=='loading')go();else document.addEventListener('DOMContentLoaded',go);addEventListener('load',go)})()`;

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
