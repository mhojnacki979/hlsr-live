import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Anton, Barlow, Saira_Condensed } from 'next/font/google'
import './globals.css'

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
  title: 'Houston Livestock Show and Rodeo Archery — Live Brackets',
  description:
    'Live bracket board for the Houston Livestock Show & Rodeo Archery Competition — every class, updating as they shoot. Powered by Eyes on Score.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const fontClasses = `${barlow.variable} ${saira.variable} ${anton.variable}`
  return (
    <html lang="en" className={fontClasses}>
      <body>{children}</body>
    </html>
  )
}
