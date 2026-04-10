import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Message } from '../types'

interface ChatPageProps {
  conversationId: string
  otherUserId: string
  onUserClick?: (userId: string) => void
}

export default function ChatPage({ conversationId, otherUserId, onUserClick }: ChatPageProps) {
  const { profile } = useApp()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMessages()
    markAsRead()

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
        if (payload.new.sender_id !== profile?.id) markAsRead()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  const markAsRead = async () => {
    if (!profile) return
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', profile.id)
      .eq('is_read', false)
  }

  const sendMessage = async () => {
    const content = input.trim()
    if (!content || !profile) return
    setInput('')
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: profile.id,
      content
    })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    return isToday
      ? d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Group messages by sender for visual batching
  const groupedMessages = messages.map((msg, i) => ({
    ...msg,
    isFirst: i === 0 || messages[i - 1].sender_id !== msg.sender_id,
    isLast: i === messages.length - 1 || messages[i + 1].sender_id !== msg.sender_id,
  }))

  return (
    <>
      {/* Messages */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-36">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">
            傳一則訊息開始對話吧
          </div>
        )}

        {groupedMessages.map(msg => {
          const isMine = msg.sender_id === profile?.id
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${msg.isFirst ? 'mt-4' : 'mt-0.5'}`}
            >
              <div className={`max-w-[72%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`px-4 py-2.5 text-sm leading-relaxed ${
                  isMine
                    ? `bg-gray-900 text-white ${msg.isFirst ? 'rounded-2xl rounded-br-sm' : msg.isLast ? 'rounded-2xl rounded-tr-sm' : 'rounded-lg'}`
                    : `bg-gray-100 text-gray-800 ${msg.isFirst ? 'rounded-2xl rounded-bl-sm' : msg.isLast ? 'rounded-2xl rounded-tl-sm' : 'rounded-lg'}`
                }`}>
                  {msg.content}
                </div>
                {msg.isLast && (
                  <span className="text-xs text-gray-400 mt-1 px-1">
                    {formatTime(msg.created_at)}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input bar — above bottom nav */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex gap-2 items-center">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="傳訊息..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-9 h-9 bg-gray-900 text-white rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
