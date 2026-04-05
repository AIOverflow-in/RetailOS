import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

const BASE_URL = 'https://retailos-landing.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: 'RetailOS — GST Billing & Inventory for Indian Medical Shops',
  description:
    'RetailOS is a fast, GST-compliant billing and inventory management system for Indian medical and grocery shops. Generate bills, track stock, and file GST returns — all at ₹10/month.',
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
  authors: [{ name: 'RetailOS' }],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: BASE_URL,
    siteName: 'RetailOS',
    title: 'RetailOS — GST Billing & Inventory for Indian Medical Shops',
    description:
      'Fast, GST-compliant billing and inventory for Indian medical and grocery shops. Real-time stock tracking, automatic CGST/SGST/IGST split, CSV export for your CA. Starting at ₹10/month.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'RetailOS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RetailOS — GST Billing & Inventory for Indian Medical Shops',
    description: 'Fast, GST-compliant billing and inventory for Indian medical shops. Starting at ₹10/month.',
    images: ['/og-image.png'],
  },
  alternates: { canonical: BASE_URL },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'RetailOS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'GST-compliant billing and inventory management for Indian medical and grocery shops.',
  offers: {
    '@type': 'Offer',
    price: '10',
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
      <body>{children}</body>
    </html>
  )
}
