import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Notification } from '../types'

interface NotificationWithPost extends Notification {
  posts?: {
    content: string
  }
}

interface NotificationPageProps {
  onPostClick?: (postId: string) => void
}

export default function NotificationPage({ onPostClick }: NotificationPageProps) {
  const { profile } = useApp()
  const [notifications, setNotifications] = useState<NotificationWithPost[]>([])

  useEffect(() => {
    if (!profile) return
    fetchNotifications()

    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, () => fetchNotifications())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  const fetchNotifications = async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*, posts(content)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setNotifications(data)
  }

  const markAllRead = async () => {
    if (!profile) return
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-gray-500">通知</h2>
          {unreadCount > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-gray-400 hover:text-gray-600">
            全部已讀
          </button>
        )}
      </div>

      {notifications.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-12">還沒有通知</div>
      )}

      <div className="space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            onClick={async () => {
              if (!notification.is_read) {
                setNotifications(prev =>
                  prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
                )
                supabase
                  .from('notifications')
                  .update({ is_read: true })
                  .eq('id', notification.id)
                  .then(() => {})
              }
              if (notification.post_id && onPostClick) {
                onPostClick(notification.post_id)
              }
            }}
            className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
              !notification.is_read ? 'border-blue-100' : 'border-gray-100'
            } ${notification.post_id ? 'cursor-pointer hover:bg-gray-50' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                  !notification.is_read ? 'bg-blue-500' : 'bg-transparent'
                }`} />
                <div>
                  <p className="text-sm text-gray-800">{notification.message}</p>
                  {/* 顯示文章內容預覽 */}
                  {notification.posts?.content && (
                    <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {notification.posts.content.length > 50
                          ? notification.posts.content.slice(0, 50) + '...'
                          : notification.posts.content}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {formatTime(notification.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}