import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Post, Comment } from '../types'

export default function HomePage() {
  const { profile } = useApp()
  const [posts, setPosts] = useState<Post[]>([])
  const [newPost, setNewPost] = useState('')
  const [waitingForReply, setWaitingForReply] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchPosts()

    const postChannel = supabase
      .channel('posts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
      .subscribe()

    const commentChannel = supabase
      .channel('comments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload: any) => {
        const postId = payload.new?.post_id || payload.old?.post_id
        if (postId) {
          fetchComments(postId)
          fetchCommentCount(postId)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(postChannel)
      supabase.removeChannel(commentChannel)
    }
  }, [])

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(username, language, is_available)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      setPosts(data)
      // 一次抓所有文章的留言數
      data.forEach(post => fetchCommentCount(post.id))
    }
  }

  const fetchCommentCount = async (postId: string) => {
    const { count } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)
    setCommentCounts(prev => ({ ...prev, [postId]: count || 0 }))
  }

  const fetchComments = async (postId: string) => {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (data) setComments(prev => ({ ...prev, [postId]: data }))
  }

  const toggleComments = async (postId: string) => {
    if (expandedPost === postId) {
      setExpandedPost(null)
    } else {
      setExpandedPost(postId)
      fetchComments(postId)
    }
  }

  const submitPost = async () => {
    if (!newPost.trim() || !profile) return
    setLoading(true)
    await supabase.from('posts').insert({
      user_id: profile.id,
      content: newPost.trim(),
      waiting_for_reply: waitingForReply
    })
    setNewPost('')
    setWaitingForReply(false)
    setLoading(false)
  }

  const submitComment = async (postId: string) => {
    const content = newComment[postId]?.trim()
    if (!content || !profile) return
    await supabase.from('comments').insert({
      post_id: postId,
      user_id: profile.id,
      content
    })
    setNewComment(prev => ({ ...prev, [postId]: '' }))
  }

  const formatTime = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
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
              waitingForReply ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
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
                  <span className="text-sm font-medium text-gray-900">{post.profiles?.username}</span>
                  {post.profiles?.is_available && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">有空</span>
                  )}
                  {post.waiting_for_reply && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">在線等</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{formatTime(post.created_at)}</span>
              </div>
            </div>

            <p className="text-sm text-gray-800 leading-relaxed mb-3">{post.content}</p>

            <button
              onClick={() => toggleComments(post.id)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              💬 留言 {commentCounts[post.id] ? `· ${commentCounts[post.id]}` : ''}
            </button>

            {expandedPost === post.id && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <div className="space-y-2 mb-3">
                  {(comments[post.id] || []).length === 0 && (
                    <p className="text-xs text-gray-400">還沒有留言</p>
                  )}
                  {(comments[post.id] || []).map(comment => (
                    <div key={comment.id} className="flex gap-2">
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                        {comment.profiles?.username?.[0]?.toUpperCase()}
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2 flex-1">
                        <span className="text-xs font-medium text-gray-700">{comment.profiles?.username}</span>
                        <p className="text-xs text-gray-600 mt-0.5">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment[post.id] || ''}
                    onChange={e => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && submitComment(post.id)}
                    placeholder="留言..."
                    className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-200"
                  />
                  <button
                    onClick={() => submitComment(post.id)}
                    className="text-xs bg-gray-900 text-white px-3 py-2 rounded-xl"
                  >
                    送出
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}