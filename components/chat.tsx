'use client';

import { Fragment, useMemo, useEffect, useRef } from 'react';
import * as React from 'react';
import { useChat, UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { RefreshCcwIcon, CopyIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getReasoningText, getTextParts } from '@/lib/utils';

import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from '@/components/ai-elements/message';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import {
    PromptInput,
    PromptInputBody,
    PromptInputFooter,
    PromptInputTools,
    PromptInputTextarea,
    PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import {
    Context,
    ContextTrigger,
    ContextContent,
    ContextContentHeader,
    ContextContentBody,
    ContextInputUsage,
    ContextOutputUsage,
} from '@/components/ai-elements/context';

import type { ChatMessage } from '@/types/chat';

export default function ChatClient({ initialMessages, contextId }: { initialMessages: UIMessage[]; contextId: string | null }) {
    const router = useRouter();
    const currentContextIdRef = useRef(contextId);
    const hasNavigated = useRef(false);

    const { messages, sendMessage, status, regenerate } = useChat<ChatMessage>({
        messages: initialMessages as ChatMessage[],
        transport: new DefaultChatTransport(),
        onError: (error: Error) => {
            toast.error('Failed to send message', {
                description: error.message,
            });
        },
    });

    // Handle new context creation - navigate when stream completes (save already done server-side)
    useEffect(() => {
        if (contextId === null && !hasNavigated.current && status === 'ready' && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'assistant' && lastMessage.metadata?.contextId) {
                const newContextId = lastMessage.metadata.contextId;
                currentContextIdRef.current = newContextId;
                hasNavigated.current = true;
                router.push(`/chat/${newContextId}`);
            }
        }
    }, [messages, contextId, status, router]);

    const totalUsage = useMemo(() => {
        return messages.reduce(
            (acc, msg) => {
                if (msg.role === 'assistant' && msg.metadata?.usage) {
                    acc.inputTokens += msg.metadata.usage.inputTokens ?? 0;
                    acc.outputTokens += msg.metadata.usage.outputTokens ?? 0;
                    acc.totalTokens += (msg.metadata.usage.inputTokens ?? 0) + (msg.metadata.usage.outputTokens ?? 0);
                }
                return acc;
            },
            { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        );
    }, [messages]);

    const handleSubmit = (message: { text: string }) => {
        if (!message.text?.trim()) return;
        sendMessage(
            { text: message.text },
            {
                body: {
                    contextId: currentContextIdRef.current,
                },
            }
        );
    };

    return (
        <div className='flex flex-col h-screen w-full max-w-4xl mx-auto px-4'>
            <Conversation className='flex-1 min-h-0 **:[scrollbar-width:none] [&_*::-webkit-scrollbar]:hidden'>
                <ConversationContent className='pb-20 pt-12'>
                    {messages.map((message, idx) => {
                        const isLast = idx === messages.length - 1;
                        const textParts = getTextParts(message);
                        const reasoningText = getReasoningText(message);

                        return (
                            <Fragment key={message.id || idx}>
                                {reasoningText && (
                                    <Message from={message.role}>
                                        <Reasoning
                                            isStreaming={status === 'streaming' && isLast && textParts.length === 0}
                                            defaultOpen={status === 'streaming' && isLast}
                                        >
                                            <ReasoningTrigger />
                                            <ReasoningContent>{reasoningText}</ReasoningContent>
                                        </Reasoning>
                                    </Message>
                                )}

                                {textParts.map((part, i) => {
                                    const isLastTextPart = isLast && i === textParts.length - 1;

                                    return (
                                        <Fragment key={`${message.id}-text-${i}`}>
                                            <Message from={message.role}>
                                                <MessageContent>
                                                    <MessageResponse>{part.text}</MessageResponse>
                                                </MessageContent>
                                            </Message>

                                            {message.role === 'assistant' && (
                                                <MessageActions>
                                                    {isLastTextPart && (
                                                        <MessageAction
                                                            onClick={() => regenerate()}
                                                            label='Retry'
                                                        >
                                                            <RefreshCcwIcon className='size-3' />
                                                        </MessageAction>
                                                    )}
                                                    <MessageAction
                                                        onClick={() => navigator.clipboard.writeText(part.text)}
                                                        label='Copy'
                                                    >
                                                        <CopyIcon className='size-3' />
                                                    </MessageAction>
                                                </MessageActions>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </Fragment>
                        );
                    })}
                </ConversationContent>
                <ConversationScrollButton className='z-10' />
            </Conversation>

            <div className='sticky bottom-0 pb-6'>
                <div className='absolute top-0 w-full h-32 -translate-y-full pointer-events-none bg-linear-to-t from-background via-background/80 to-transparent backdrop-blur-xl mask-[linear-gradient(to_top,black,transparent)]' />
                <PromptInput onSubmit={handleSubmit}>
                    <PromptInputBody>
                        <PromptInputTextarea placeholder='Message...' />
                    </PromptInputBody>
                    <PromptInputFooter>
                        <PromptInputTools>
                            <Context
                                usedTokens={totalUsage.totalTokens}
                                maxTokens={128000}
                                usage={{
                                    inputTokens: totalUsage.inputTokens,
                                    outputTokens: totalUsage.outputTokens,
                                    totalTokens: totalUsage.totalTokens,
                                }}
                                modelId='openai:gpt-4o'
                            >
                                <ContextTrigger />
                                <ContextContent>
                                    <ContextContentHeader />
                                    <ContextContentBody>
                                        <ContextInputUsage />
                                        <ContextOutputUsage />
                                    </ContextContentBody>
                                </ContextContent>
                            </Context>
                        </PromptInputTools>
                        <PromptInputSubmit status={status === 'streaming' ? 'streaming' : 'ready'} />
                    </PromptInputFooter>
                </PromptInput>
            </div>
        </div>
    );
}
