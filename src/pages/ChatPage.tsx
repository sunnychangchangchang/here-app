import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Message } from '../types'
import { uploadImage } from '../utils/imageUtils'

interface ChatPageProps {
  conversationId: string
  otherUserId: string
  onUserClick?: (userId: string) => void
  headerH?: number
  tabbarH?: number
}

export default function ChatPage({ conversationId, headerH = 54, tabbarH = 64 }: ChatPageProps) {
  const { profile } = useApp()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [keyboardH, setKeyboardH] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // visualViewport 偵測鍵盤高度
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardH(kh)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // 鍵盤開關時滾到底
  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 80)
    return () => clearTimeout(timer)
  }, [keyboardH])

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

  const sendMessage = async (content = input.trim(), image_url: string | null = null) => {
    if (!content && !image_url) return
    if (!profile) return
    setInput('')
    inputRef.current?.focus()
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: profile.id,
      content: content || '',
      image_url
    })
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    e.target.value = ''
    setUploadingImage(true)
    const url = await uploadImage(file, 'post-images', `dm/${profile.id}`)
    await sendMessage('', url)
    setUploadingImage(false)
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    return isToday
      ? d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const groupedMessages = messages.map((msg, i) => ({
    ...msg,
    isFirst: i === 0 || messages[i - 1].sender_id !== msg.sender_id,
    isLast: i === messages.length - 1 || messages[i + 1].sender_id !== msg.sender_id,
  }))

  const inputBarH = 64
  const inputBottom = tabbarH + keyboardH

  return (
    <>
      {/* 訊息區域 — fixed，上方留 header，下方留 input bar */}
      <div
        ref={messagesRef}
        className="fixed left-0 right-0 overflow-y-auto"
        style={{
          top: headerH,
          bottom: inputBottom + inputBarH,
        }}
      >
        <div className="max-w-lg mx-auto px-4 pt-2 pb-2">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12">傳一則訊息開始對話吧</div>
          )}

          {groupedMessages.map(msg => {
            const isMine = msg.sender_id === profile?.id
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${msg.isFirst ? 'mt-4' : 'mt-0.5'}`}
              >
                <div className={`max-w-[72%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      onClick={() => setLightboxUrl(msg.image_url!)}
                      className={`max-w-full object-cover cursor-pointer active:opacity-80 transition-opacity ${
                        isMine ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
                      }`}
                      style={{ maxHeight: '240px' }}
                    />
                  )}
                  {msg.content && (
                    <div className={`px-4 py-2.5 text-sm leading-relaxed ${
                      isMine
                        ? `bg-gray-900 text-white ${msg.isFirst ? 'rounded-2xl rounded-br-sm' : msg.isLast ? 'rounded-2xl rounded-tr-sm' : 'rounded-lg'}`
                        : `bg-gray-100 text-gray-800 ${msg.isFirst ? 'rounded-2xl rounded-bl-sm' : msg.isLast ? 'rounded-2xl rounded-tl-sm' : 'rounded-lg'}`
                    }`}>
                      {msg.content}
                    </div>
                  )}
                  {msg.isLast && (
                    <span className="text-xs text-gray-400 mt-1 px-1">{formatTime(msg.created_at)}</span>
                  )}
                </div>
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div
        className="fixed left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-20"
        style={{ bottom: inputBottom }}
      >
        <div className="max-w-lg mx-auto flex gap-2 items-center">
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            className="w-9 h-9 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center flex-shrink-0 active:bg-gray-200 transition-colors disabled:opacity-40"
          >
            {uploadingImage ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            ref={inputRef}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="傳訊息..."
            style={{ fontSize: '16px' }}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 focus:outline-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim()}
            className="w-9 h-9 bg-gray-900 text-white rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-transform"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-white/20 text-white rounded-full flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  )
}
