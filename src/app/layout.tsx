import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider';
import { ReactScanProvider } from '@/components/ReactScanProvider';
import Footer from '@/components/footer';

export const metadata: Metadata = {
  title: 'EQ RTS MAP',
  description: 'EQ RTS MAP',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body>
        <ReactScanProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Footer />
          </ThemeProvider>
        </ReactScanProvider>
      </body>
    </html>
  )
}
