import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Notification, ConversationRequest } from '../types'

interface NotificationWithPost extends Notification {
  posts?: { content: string }
}

interface NotificationPageProps {
  onPostClick?: (postId: string) => void
  onStartChat?: (conversationId: string, otherUserId: string, otherUsername: string) => void
}

export default function NotificationPage({ onPostClick, onStartChat }: NotificationPageProps) {
  const { profile } = useApp()
  const [notifications, setNotifications] = useState<NotificationWithPost[]>([])
  const [requests, setRequests] = useState<ConversationRequest[]>([])

  useEffect(() => {
    if (!profile) return
    fetchNotifications()
    fetchRequests()

    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_requests', filter: `receiver_id=eq.${profile.id}` },
        () => fetchRequests())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  const fetchNotifications = async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*, posts(content)')
      .eq('user_id', profile.id)
      .neq('type', 'conversation_request')
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setNotifications(data)
  }

  const fetchRequests = async () => {
    if (!profile) return
    const { data } = await supabase
      .from('conversation_requests')
      .select('*, profiles(username, bio), posts(content, tags)')
      .eq('receiver_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (data) setRequests(data)
  }

  const handleAccept = async (req: ConversationRequest) => {
    // 建立或取得對話
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(user1_id.eq.${profile!.id},user2_id.eq.${req.sender_id}),and(user1_id.eq.${req.sender_id},user2_id.eq.${profile!.id})`)
      .maybeSingle()

    let conversationId = existing?.id
    if (!conversationId) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ user1_id: profile!.id, user2_id: req.sender_id })
        .select('id').single()
      conversationId = newConv?.id
    }

    await supabase.from('conversation_requests').update({ status: 'accepted' }).eq('id', req.id)
    setRequests(prev => prev.filter(r => r.id !== req.id))

    if (conversationId && onStartChat) {
      onStartChat(conversationId, req.sender_id, (req.profiles as any)?.username || '')
    }
  }

  const handleIgnore = async (reqId: string) => {
    await supabase.from('conversation_requests').update({ status: 'ignored' }).eq('id', reqId)
    setRequests(prev => prev.filter(r => r.id !== reqId))
  }

  const handleBlock = async (reqId: string, senderId: string) => {
    await supabase.from('conversation_requests').update({ status: 'blocked' }).eq('id', reqId)
    // 封鎖此用戶的所有未來請求
    await supabase.from('conversation_requests')
      .update({ status: 'blocked' })
      .eq('sender_id', senderId)
      .eq('receiver_id', profile!.id)
      .eq('status', 'pending')
    setRequests(prev => prev.filter(r => r.id !== reqId))
  }

  const markAllRead = async () => {
    if (!profile) return
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
  }

  const formatTime = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '剛剛'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
    return `${Math.floor(diff / 86400)} 天前`
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="max-w-lg mx-auto px-4 py-6">

      {/* 對話請求 */}
      {requests.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">對話請求 · {requests.length}</p>
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 flex-shrink-0">
                    {(req.profiles as any)?.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">{(req.profiles as any)?.username}</span>
                      <span className="text-xs text-gray-400">{formatTime(req.created_at)}</span>
                    </div>
                    {/* 回覆內容 */}
                    <p className="text-sm text-gray-800 mt-1 leading-relaxed">「{req.message}」</p>
                    {/* 對應的貼文預覽 */}
                    {req.posts?.content && (
                      <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-xs text-gray-400">回覆你的話題</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                          {req.posts.content.length > 60 ? req.posts.content.slice(0, 60) + '...' : req.posts.content}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(req)}
                    className="flex-1 bg-gray-900 text-white text-xs py-2 rounded-xl font-medium hover:bg-gray-700 transition-colors"
                  >
                    接受，開始聊
                  </button>
                  <button
                    onClick={() => handleIgnore(req.id)}
                    className="px-4 text-xs text-gray-500 border border-gray-200 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    忽略
                  </button>
                  <button
                    onClick={() => handleBlock(req.id, req.sender_id)}
                    className="px-4 text-xs text-red-400 border border-red-100 py-2 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    封鎖
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 一般通知 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">通知</p>
          {unreadCount > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-gray-400 hover:text-gray-600">全部已讀</button>
        )}
      </div>

      {notifications.length === 0 && requests.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-12">還沒有通知</div>
      )}

      <div className="space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            onClick={async () => {
              if (!notification.is_read) {
                setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n))
                supabase.from('notifications').update({ is_read: true }).eq('id', notification.id).then(() => {})
              }
              if (notification.post_id && onPostClick) onPostClick(notification.post_id)
            }}
            className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
              !notification.is_read ? 'border-blue-100' : 'border-gray-100'
            } ${notification.post_id ? 'cursor-pointer' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${!notification.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
                <div>
                  <p className="text-sm text-gray-800">{notification.message}</p>
                  {notification.posts?.content && (
                    <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {notification.posts.content.length > 50 ? notification.posts.content.slice(0, 50) + '...' : notification.posts.content}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(notification.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
