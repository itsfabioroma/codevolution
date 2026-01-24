import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { UIMessage } from 'ai';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// extract joined reasoning text from message parts
export function getReasoningText(message: UIMessage): string {
    if (!message.parts) return '';
    return message.parts
        .filter((p): p is { type: 'reasoning'; text: string } => p.type === 'reasoning')
        .map((p) => p.text)
        .join('');
}

// extract text parts from message
export function getTextParts(message: UIMessage): { type: 'text'; text: string }[] {
    if (!message.parts) return [];
    return message.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text');
}
