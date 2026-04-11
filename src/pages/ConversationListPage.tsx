import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import { MessageIcon } from '../components/icons'

interface ConvItem {
  id: string
  otherUser: { id: string; username: string; is_available: boolean }
  lastMessage: { content: string; created_at: string; is_read: boolean; sender_id: string } | null
  unreadCount: number
}

interface ConversationListPageProps {
  onStartChat: (conversationId: string, otherUserId: string, otherUsername: string) => void
  onUserClick?: (userId: string) => void
}

export default function ConversationListPage({ onStartChat }: ConversationListPageProps) {
  const { profile } = useApp()
  const [conversations, setConversations] = useState<ConvItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversations()

    const channel = supabase
      .channel('conversations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchConversations())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => fetchConversations())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchConversations = async () => {
    if (!profile) return

    const { data: convs } = await supabase
      .from('conversations')
      .select('id, user1_id, user2_id, created_at')
      .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)

    if (!convs?.length) { setConversations([]); setLoading(false); return }

    const otherUserIds = convs.map(c => c.user1_id === profile.id ? c.user2_id : c.user1_id)
    const convIds = convs.map(c => c.id)

    const [profilesRes, messagesRes] = await Promise.all([
      supabase.from('profiles').select('id, username, is_available').in('id', otherUserIds),
      supabase.from('messages').select('*').in('conversation_id', convIds).order('created_at', { ascending: false })
    ])

    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]))
    const messagesByConv: Record<string, any[]> = {}
    for (const msg of messagesRes.data || []) {
      if (!messagesByConv[msg.conversation_id]) messagesByConv[msg.conversation_id] = []
      messagesByConv[msg.conversation_id].push(msg)
    }

    const items: ConvItem[] = convs.map(conv => {
      const otherUserId = conv.user1_id === profile.id ? conv.user2_id : conv.user1_id
      const convMessages = messagesByConv[conv.id] || []
      return {
        id: conv.id,
        otherUser: profileMap.get(otherUserId) || { id: otherUserId, username: '?', is_available: false },
        lastMessage: convMessages[0] || null,
        unreadCount: convMessages.filter(m => !m.is_read && m.sender_id !== profile.id).length
      }
    }).sort((a, b) => {
      const aTime = a.lastMessage?.created_at || ''
      const bTime = b.lastMessage?.created_at || ''
      return bTime.localeCompare(aTime)
    })

    setConversations(items)
    setLoading(false)
  }

  const formatTime = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '剛剛'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 時`
    return `${Math.floor(diff / 86400)} 天`
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">載入中...</div>
  }

  return (
    <div className="max-w-lg mx-auto">
      {conversations.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center">
            <MessageIcon className="w-7 h-7" />
          </div>
          <p className="text-sm text-gray-500">還沒有對話</p>
          <p className="text-xs text-gray-400 mt-1">去別人的頁面按「傳訊息」開始聊天</p>
        </div>
      ) : (
        conversations.map(conv => (
          <div
            key={conv.id}
            onClick={() => onStartChat(conv.id, conv.otherUser.id, conv.otherUser.username)}
            className="pressable-card flex items-center gap-3 px-4 py-4 cursor-pointer border-b border-gray-100/70"
          >
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-base font-medium text-gray-600">
                {conv.otherUser.username[0].toUpperCase()}
              </div>
              {conv.otherUser.is_available && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-sm ${conv.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                  {conv.otherUser.username}
                </span>
                {conv.lastMessage && (
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {formatTime(conv.lastMessage.created_at)}
                  </span>
                )}
              </div>
              <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                {conv.lastMessage
                  ? conv.lastMessage.sender_id === profile?.id
                    ? `你：${conv.lastMessage.content}`
                    : conv.lastMessage.content
                  : '開始對話'}
              </p>
            </div>

            {conv.unreadCount > 0 && (
              <div className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
