import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Post } from '../types'

export default function HomePage() {
  const { profile } = useApp()
  const [posts, setPosts] = useState<Post[]>([])
  const [newPost, setNewPost] = useState('')
  const [waitingForReply, setWaitingForReply] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchPosts()

    // 即時監聽新文章
    const channel = supabase
      .channel('posts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts'
      }, () => {
        fetchPosts()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(username, language, is_available)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setPosts(data)
  }

  const submitPost = async () => {
    if (!newPost.trim() || !profile) return
    setLoading(true)

    const { error } = await supabase.from('posts').insert({
      user_id: profile.id,
      content: newPost.trim(),
      waiting_for_reply: waitingForReply
    })

    if (!error) {
      setNewPost('')
      setWaitingForReply(false)
      fetchPosts()
    }
    setLoading(false)
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diff < 60) return '剛剛'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
    return `${Math.floor(diff / 86400)} 天前`
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* 發文框 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder="你在想什麼？有問題想找人聊聊嗎？"
          className="w-full text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none"
          rows={3}
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <button
            onClick={() => setWaitingForReply(!waitingForReply)}
            className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full transition-all ${
              waitingForReply
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span>{waitingForReply ? '🟢' : '⚪'}</span>
            在線等回覆
          </button>
          <button
            onClick={submitPost}
            disabled={loading || !newPost.trim()}
            className="bg-gray-900 text-white text-xs px-4 py-1.5 rounded-full disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            發布
          </button>
        </div>
      </div>

      {/* 文章列表 */}
      <div className="space-y-3">
        {posts.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">
            還沒有人發文，來第一個吧
          </div>
        )}
        {posts.map(post => (
          <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                {post.profiles?.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {post.profiles?.username}
                  </span>
                  {post.profiles?.is_available && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      有空
                    </span>
                  )}
                  {post.waiting_for_reply && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      在線等
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{formatTime(post.created_at)}</span>
              </div>
            </div>
            <p className="text-sm text-gray-800 leading-relaxed">{post.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
