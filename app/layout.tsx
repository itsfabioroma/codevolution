import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

export const metadata: Metadata = {
    title: '[UC] Vercel AI SDK Agent',
    description: 'Vercel AI SDK Agent',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang='en'
            suppressHydrationWarning
        >
            <body className='antialiased'>
                <ThemeProvider
                    attribute='class'
                    forcedTheme='light'
                >
                    <SidebarProvider>
                        <AppSidebar />
                        <SidebarInset className='relative'>
                            <SidebarTrigger className='absolute top-5 left-3 z-10' />
                            <Toaster />
                            {children}
                        </SidebarInset>
                    </SidebarProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
