import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Anton, Barlow, Playfair_Display, Saira_Condensed } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  weight: ['700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-playfair',
})

const barlow = Barlow({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow',
})

const saira = Saira_Condensed({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-saira',
})

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
})

export const metadata: Metadata = {
  title: 'HLSR Archery — Live Brackets',
  description:
    'Live bracket board for the Houston Livestock Show & Rodeo Archery Competition — every class, updating as they shoot. Powered by Eyes on Score.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const fontClasses = `${playfair.variable} ${barlow.variable} ${saira.variable} ${anton.variable}`
  return (
    <html lang="en" className={fontClasses}>
      <body>{children}</body>
    </html>
  )
}
