import { UltraContext } from 'ultracontext';
import { convertToUIMessages } from '@/helpers/anthropic-messages';
import type { NodeResponse } from '@/types/chat';
import Chat from '@/components/chat';
import { redirect } from 'next/navigation';

export default async function ChatPage({ params }: { params: Promise<{ contextId: string }> }) {
    const { contextId } = await params;

    const apiKey = process.env.ULTRACONTEXT_API_KEY;
    if (!apiKey) throw new Error('Missing ULTRACONTEXT_API_KEY');

    const uc = new UltraContext({ apiKey });

    let initialMessages;
    try {
        const ctx = await uc.get<NodeResponse>(contextId);
        initialMessages = convertToUIMessages(ctx.data as NodeResponse[]);
    } catch (error) {
        console.error('Failed to load context:', error);
        redirect('/');
    }

    return (
        <Chat
            initialMessages={initialMessages}
            contextId={contextId}
        />
    );
}
