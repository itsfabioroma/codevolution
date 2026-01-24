'use client';

import { cn } from '@/lib/utils';

interface UCLogoProps {
    className?: string;
    animate?: boolean;
}

// UltraContext logo: [O] - brackets with circle
export function UCLogo({ className, animate }: UCLogoProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(className, animate && 'animate-pulse')}
        >
            {/* left bracket - moved outward */}
            <path d="M6 4H4v16h2" />

            {/* right bracket - moved outward */}
            <path d="M18 4h2v16h-2" />

            {/* center circle - smaller for more space */}
            <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        </svg>
    );
}
