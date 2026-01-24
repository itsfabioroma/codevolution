'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PlusIcon, MessageSquareIcon } from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

interface Context {
    id: string;
    metadata?: {
        name?: string;
    };
}

export function AppSidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const [contexts, setContexts] = useState<Context[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    // Handle client-side mount
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch contexts list - refetch when navigating to a context not in list
    useEffect(() => {
        if (!mounted) return;

        // Check if current path is a context we don't have yet
        const contextMatch = pathname.match(/^\/chat\/(.+)$/);
        const currentContextId = contextMatch?.[1];
        const hasContext = contexts.some((c) => c.id === currentContextId);

        // Skip refetch if we already have this context (or not on a context page)
        if (currentContextId && hasContext) return;

        async function loadContexts() {
            setLoading(contexts.length === 0);
            try {
                const response = await fetch('/api/contexts');
                if (response.ok) {
                    const result = await response.json();
                    setContexts(result.contexts?.data || []);
                }
            } catch (error) {
                console.error('Failed to load contexts:', error);
            } finally {
                setLoading(false);
            }
        }

        loadContexts();
    }, [mounted, pathname]);

    // Handle new chat
    const handleNewChat = () => {
        router.push('/');
    };

    // Truncate first message for display
    const getContextName = (context: Context) => {
        return context.metadata?.name || 'New Chat';
    };

    // Check if context is active
    const isActive = (contextId: string) => {
        return pathname === `/chat/${contextId}`;
    };

    console.log('contexts:', contexts);

    return (
        <Sidebar className='py-2 px-1'>
            <SidebarHeader>
                <Button
                    onClick={handleNewChat}
                    className='w-full justify-start'
                    variant='outline'
                >
                    <PlusIcon className='size-4' />
                    New Chat
                </Button>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Chats</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {!mounted ? null : loading ? (

// Loading skeleton
                                Array.from({ length: 5 }).map((_, index) => (
                                    <SidebarMenuItem key={index}>
                                        <SidebarMenuSkeleton showIcon />
                                    </SidebarMenuItem>
                                ))
                            ) : contexts.length === 0 ? (
                                // Empty state
                                <div className='px-2 py-4 text-center text-sm text-muted-foreground'>
                                    No chats yet
                                </div>
                            ) : (
                                // Context list
                                contexts.map((context) => (
                                    <SidebarMenuItem key={context.id}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive(context.id)}
                                        >
                                            <a href={`/chat/${context.id}`}>
                                                <MessageSquareIcon />
                                                <span>{getContextName(context)}</span>
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
