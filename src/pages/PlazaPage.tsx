import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Profile, Post } from '../types'

const LANGUAGES = [
  { code: 'zh-TW', label: '繁中', flag: '🇹🇼' },
  { code: 'zh-CN', label: '簡中', flag: '🇨🇳' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
]

interface PlazaPageProps {
  onUserClick?: (userId: string) => void
}

export default function PlazaPage({ onUserClick }: PlazaPageProps) {
  const { profile } = useApp()
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([])
  const [userPosts, setUserPosts] = useState<Record<string, Post>>({})
  const [isAvailable, setIsAvailable] = useState(false)
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [showReplyFor, setShowReplyFor] = useState<string | null>(null)
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set())
  const [sendingRequest, setSendingRequest] = useState(false)

  useEffect(() => {
    if (profile) setIsAvailable(profile.is_available)
    fetchAvailableUsers()

    const channel = supabase
      .channel('availability-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAvailableUsers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchAvailableUsers())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchAvailableUsers = async () => {
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_available', true)
      .order('created_at', { ascending: false })
    if (!users) return
    setAvailableUsers(users)

    // 取每個人最新的有效話題
    if (users.length > 0) {
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .in('user_id', users.map(u => u.id))
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      // 每人只留最新一篇
      const latest: Record<string, Post> = {}
      for (const post of posts || []) {
        if (!latest[post.user_id]) latest[post.user_id] = post
      }
      setUserPosts(latest)

      // 抓已發出的請求
      if (profile && posts?.length) {
        const { data: sent } = await supabase
          .from('conversation_requests')
          .select('post_id')
          .eq('sender_id', profile.id)
          .in('post_id', (posts || []).map(p => p.id))
        if (sent) setSentRequests(new Set(sent.map(r => r.post_id)))
      }
    }
  }

  const toggleAvailability = async () => {
    if (!profile) return
    const newStatus = !isAvailable
    setIsAvailable(newStatus)
    await supabase.from('profiles').update({ is_available: newStatus }).eq('id', profile.id)
  }

  const submitRequest = async (post: Post, targetUser: Profile) => {
    const message = replyInputs[post.id]?.trim()
    if (!message || !profile) return
    setSendingRequest(true)
    const { error } = await supabase.from('conversation_requests').insert({
      post_id: post.id,
      sender_id: profile.id,
      receiver_id: targetUser.id,
      message,
    })
    if (!error) {
      setSentRequests(prev => new Set(prev).add(post.id))
      setReplyInputs(prev => ({ ...prev, [post.id]: '' }))
      setShowReplyFor(null)
      await supabase.from('notifications').insert({
        user_id: targetUser.id,
        type: 'conversation_request',
        message: `${profile.username} 想和你聊聊`,
        post_id: post.id,
      })
    }
    setSendingRequest(false)
  }

  const formatExpiry = (expiresAt: string) => {
    const mins = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000)
    if (mins <= 0) return null
    if (mins < 60) return `${mins} 分`
    return `${Math.floor(mins / 60)} 小時`
  }

  const getLanguageLabel = (code: string) => {
    const lang = LANGUAGES.find(l => l.code === code)
    return lang ? `${lang.flag} ${lang.label}` : code
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">

      {/* 我的狀態 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div onClick={toggleAvailability} className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {isAvailable ? '我現在有空' : '我在忙'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isAvailable ? '其他人可以看到你在線' : '開啟讓別人知道你有空'}
            </p>
          </div>
          <div className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${isAvailable ? 'bg-green-500' : 'bg-gray-200'}`}>
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${isAvailable ? 'translate-x-7' : 'translate-x-1'}`} />
          </div>
        </div>
      </div>

      {/* 人員雷達 */}
      <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
        現在有空 · {availableUsers.length} 人
      </p>

      {availableUsers.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-12 bg-white rounded-2xl border border-gray-100">
          目前沒有人有空<br />
          <span className="text-xs mt-1 block">成為第一個掛上有空標記的人</span>
        </div>
      )}

      <div className="space-y-3">
        {availableUsers.map(user => {
          const isOwn = user.id === profile?.id
          const post = userPosts[user.id]
          const hasSent = post ? sentRequests.has(post.id) : false
          const isShowingReply = post ? showReplyFor === post.id : false

          return (
            <div key={user.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
              isOwn ? 'border-green-200' : 'border-gray-100'
            }`}>
              {/* 用戶資訊列 */}
              <div
                onClick={() => !isOwn && onUserClick?.(user.id)}
                className={`flex items-center gap-3 p-4 ${!isOwn ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center text-base font-semibold text-gray-600">
                    {user.username[0].toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">{user.username}</span>
                    {isOwn && <span className="text-xs text-gray-400">（你）</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-gray-400">{getLanguageLabel(user.language)}</span>
                    {user.bio && <span className="text-xs text-gray-400 truncate">· {user.bio}</span>}
                  </div>
                </div>
              </div>

              {/* 話題預覽 */}
              {post && (
                <div className="px-4 pb-4 pt-0">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-700 leading-relaxed flex-1">{post.content}</p>
                      {post.expires_at && formatExpiry(post.expires_at) && (
                        <span className="text-xs text-orange-400 flex-shrink-0">{formatExpiry(post.expires_at)}後消失</span>
                      )}
                    </div>
                    {post.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {post.tags.map(tag => (
                          <span key={tag} className="text-xs text-blue-400">#{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* 回覆按鈕 */}
                    {!isOwn && (
                      <div className="mt-3">
                        {hasSent ? (
                          <p className="text-xs text-gray-400">已發送請求</p>
                        ) : isShowingReply ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyInputs[post.id] || ''}
                              onChange={e => setReplyInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && submitRequest(post, user)}
                              placeholder={`傳訊息給 ${user.username}...`}
                              autoFocus
                              className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none bg-white"
                            />
                            <button
                              onClick={() => submitRequest(post, user)}
                              disabled={!replyInputs[post.id]?.trim() || sendingRequest}
                              className="text-xs bg-gray-900 text-white px-3 py-2 rounded-xl disabled:opacity-40"
                            >
                              送出
                            </button>
                            <button
                              onClick={() => setShowReplyFor(null)}
                              className="text-xs text-gray-400 px-2"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowReplyFor(post.id)}
                            className="text-xs text-blue-500 hover:text-blue-700 transition-colors font-medium"
                          >
                            回覆這個話題 →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
