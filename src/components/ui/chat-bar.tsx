"use client"

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_edited: boolean | null;
  sender: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function ChatBar() {
  const { profile, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [profile?.id]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const fetchMessages = async () => {
    console.log('ChatBar: Fetching messages...');
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          is_edited,
          sender:profiles!messages_sender_id_fkey(id, username, full_name, avatar_url)
        `)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        console.error('ChatBar: Error fetching messages:', error);
        if (error.code === 'PGRST116') {
          console.log('ChatBar: Messages table does not exist');
        }
        setMessages([]);
      } else {
        console.log('ChatBar: Fetched messages:', data?.length || 0);
        setMessages(data || []);
      }
    } catch (err) {
      console.error('ChatBar: Unexpected error:', err);
      setMessages([]);
    }
    setLoading(false);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Fetch the complete message with sender info
          supabase
            .from('messages')
            .select(`
              id,
              content,
              created_at,
              sender_id,
              is_edited,
              sender:profiles!messages_sender_id_fkey(id, username, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setMessages(prev => [...prev, data as Message]);
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let messageContent = '';
    try {
      if (!newMessage.trim() || !profile?.id) return;

      messageContent = newMessage.trim();
      setNewMessage('');

      // Create message for UI (will persist even if DB fails)
      const newMessageObj: Message = {
        id: `local-${Date.now()}-${Math.random()}`,
        content: messageContent,
        created_at: new Date().toISOString(),
        sender_id: profile.id,
        is_edited: null,
        sender: {
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        },
      };

      // Add message to UI immediately
      setMessages(prev => [...prev, newMessageObj]);

      try {
        const { error } = await supabase
          .from('messages')
          .insert({
            sender_id: profile.id,
            content: messageContent,
          });

        if (error) {
          console.error('ChatBar: Error sending message:', error);
          // Mark message as failed but keep it visible
          setMessages(prev => prev.map(msg =>
            msg.id === newMessageObj.id
              ? { ...msg, id: `failed-${msg.id}` }
              : msg
          ));
        } else {
          // Mark message as sent successfully
          setMessages(prev => prev.map(msg =>
            msg.id === newMessageObj.id
              ? { ...msg, id: `sent-${Date.now()}` }
              : msg
          ));
          console.log('ChatBar: Message sent successfully');
        }
      } catch (dbError) {
        console.error('ChatBar: Database error:', dbError);
        // Mark message as failed but keep it visible
        setMessages(prev => prev.map(msg =>
          msg.id === newMessageObj.id
            ? { ...msg, id: `failed-${msg.id}` }
            : msg
        ));
      }
    } catch (generalError) {
      console.error('ChatBar: General error in sendMessage:', generalError);
      // Re-add the text to input if something went wrong
      if (messageContent) {
        setNewMessage(messageContent);
      }
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const retryMessage = async (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (!message) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: message.sender_id,
          content: message.content,
        });

      if (error) {
        console.error('ChatBar: Retry failed:', error);
      } else {
        // Mark as sent and update ID
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, id: `sent-${Date.now()}` }
            : msg
        ));
        console.log('ChatBar: Message retry successful');
      }
    } catch (err) {
      console.error('ChatBar: Retry error:', err);
    }
  };

  if (!user) {
    console.log('ChatBar: No user, not rendering');
    return null;
  }

  console.log('ChatBar: Rendering for user', user.id);

  return (
    <div className="fixed bottom-28 right-4 z-40 max-w-md w-full">
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-background border border-border rounded-lg shadow-glow w-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-semibold text-foreground">Community Chat</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="h-64 p-3" ref={scrollAreaRef}>
              {loading ? (
                <div className="text-center text-muted-foreground py-4">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">Start the conversation! Messages will appear here instantly.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex gap-2 ${
                    message.id.startsWith('failed-') ? 'opacity-60' :
                    message.id.startsWith('local-') ? 'opacity-80' : ''
                  }`}>
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={message.sender?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(message.sender?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-medium text-foreground text-sm">
                            {message.sender?.full_name || 'Anonymous'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground break-words">
                          {message.content}
                          {message.id.startsWith('failed-') && (
                            <button
                              onClick={() => retryMessage(message.id)}
                              className="text-xs text-destructive ml-2 hover:text-destructive/80 underline"
                            >
                              Retry
                            </button>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  maxLength={500}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newMessage.trim()}
                  className="px-3"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex justify-end"
          >
            <Button
              onClick={() => setIsExpanded(true)}
              className="rounded-full shadow-glow h-12 w-12 p-0"
              size="lg"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}