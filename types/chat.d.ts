import type { UIMessage, LanguageModelUsage } from 'ai';

// Metadata type for usage tracking on messages
export type MessageMetadata = {
    usage?: LanguageModelUsage;
    contextId?: string;
};

// Custom UIMessage type with metadata
export type ChatMessage = UIMessage<MessageMetadata>;

export type NodeResponse = {
    id?: string;
    type?: string;
    content: unknown;
    metadata?: Record<string, unknown>;
    created_at?: string;
    parent_id?: string;
    [k: string]: unknown;
};
