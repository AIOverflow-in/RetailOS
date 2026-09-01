import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

const BASE_URL = 'https://sellos.in'

// Set in Vercel (Production only) once the pixel exists in Business Manager.
// Unset = no script, no tracking.
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: 'SellOS — GST Billing & Inventory for Indian Medical Shops',
  description:
    'SellOS is a fast, GST-compliant billing and inventory management system for Indian medical and grocery shops. Generate bills, track stock, and file GST returns. First month free, then ₹799/month.',
  keywords: [
    'GST billing software India',
    'medical shop billing software',
    'pharmacy billing software',
    'inventory management India',
    'GST invoice software',
    'retail billing software India',
    'POS software medical shop',
    'CGST SGST billing',
    'HSN code billing',
    'multi-tenant POS',
  ],
  authors: [{ name: 'SellOS' }],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: BASE_URL,
    siteName: 'SellOS',
    title: 'SellOS — GST Billing & Inventory for Indian Medical Shops',
    description:
      'Fast, GST-compliant billing and inventory for Indian medical and grocery shops. Real-time stock tracking, automatic CGST/SGST/IGST split, CSV export for your CA. First month free, then ₹799/month.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'SellOS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SellOS — GST Billing & Inventory for Indian Medical Shops',
    description: 'Fast, GST-compliant billing and inventory for Indian medical shops. First month free, then ₹799/month.',
    images: ['/og-image.png'],
  },
  alternates: { canonical: BASE_URL },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SellOS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'GST-compliant billing and inventory management for Indian medical and grocery shops.',
  offers: {
    '@type': 'Offer',
    price: '799',
    priceCurrency: 'INR',
  },
  featureList: [
    'GST-compliant billing (CGST/SGST/IGST)',
    'Real-time inventory tracking',
    'Batch and expiry date management',
    'Customer management',
    'GST reports with CSV export',
    'Multi-tenant architecture',
    'Indian financial year support',
    'HSN code support',
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.className}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        {META_PIXEL_ID && (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
          </Script>
        )}
      </body>
    </html>
  )
}
