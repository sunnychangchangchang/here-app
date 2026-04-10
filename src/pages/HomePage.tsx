import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Post, Comment } from '../types'

interface HomePageProps {
  onTagClick?: (tag: string) => void
  onUserClick?: (userId: string) => void
  highlightPostId?: string | null
}

export default function HomePage({ onTagClick, onUserClick, highlightPostId }: HomePageProps) {
  const { profile } = useApp()
  const [posts, setPosts] = useState<Post[]>([])
  const [newPost, setNewPost] = useState('')
  const [waitingForReply, setWaitingForReply] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const [scrollToLastCommentPostId, setScrollToLastCommentPostId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!highlightPostId) return
    setExpandedPost(highlightPostId)
    setScrollToLastCommentPostId(highlightPostId)
    fetchComments(highlightPostId)
    setTimeout(() => {
      document.getElementById(`post-${highlightPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 300)
  }, [highlightPostId])

  // 當留言載入完後，自動 scroll 到最後一則
  useEffect(() => {
    if (!scrollToLastCommentPostId) return
    const postComments = comments[scrollToLastCommentPostId]
    if (!postComments?.length) return
    const lastComment = postComments[postComments.length - 1]
    setTimeout(() => {
      document.getElementById(`comment-${lastComment.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setScrollToLastCommentPostId(null)
    }, 400)
  }, [comments, scrollToLastCommentPostId])

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(username, language, is_available)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      setPosts(data)
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

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const tag = tagInput.trim().replace(/^#/, '')
      if (tag && !tags.includes(tag) && tags.length < 5) {
        setTags(prev => [...prev, tag])
      }
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag))
  }

  const submitPost = async () => {
    if (!newPost.trim() || !profile) return
    setLoading(true)
    await supabase.from('posts').insert({
      user_id: profile.id,
      content: newPost.trim(),
      waiting_for_reply: waitingForReply,
      tags
    })
    setNewPost('')
    setWaitingForReply(false)
    setTags([])
    setTagInput('')
    setLoading(false)
  }

  const deletePost = async (postId: string) => {
    if (!profile) return

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', profile.id)

    if (error) return

    setPosts(prev => prev.filter(post => post.id !== postId))
    setComments(prev => {
      const next = { ...prev }
      delete next[postId]
      return next
    })
    setCommentCounts(prev => {
      const next = { ...prev }
      delete next[postId]
      return next
    })
    setNewComment(prev => {
      const next = { ...prev }
      delete next[postId]
      return next
    })
    if (expandedPost === postId) {
      setExpandedPost(null)
    }
  }

  const deleteComment = async (commentId: string, postId: string) => {
    if (!profile) return
    // Optimistic update
    setComments(prev => ({
      ...prev,
      [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
    }))
    setCommentCounts(prev => ({ ...prev, [postId]: Math.max((prev[postId] || 1) - 1, 0) }))
    await supabase.from('comments').delete().eq('id', commentId).eq('user_id', profile.id)
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

    // 通知文章作者（不通知自己）
    const post = posts.find(p => p.id === postId)
    if (!post || post.user_id === profile.id) return

    // 取得這篇文章所有留言者（排除作者），組成聚合訊息
    const { data: allComments } = await supabase
      .from('comments')
      .select('user_id, profiles(username)')
      .eq('post_id', postId)
      .neq('user_id', post.user_id)

    const seen = new Set<string>()
    const uniqueCommenters: string[] = []
    for (const c of allComments || []) {
      const username = (c.profiles as any)?.username
      if (username && !seen.has(username)) {
        seen.add(username)
        uniqueCommenters.push(username)
      }
    }

    const preview = post.content.length > 20 ? post.content.slice(0, 20) + '...' : post.content
    let message = ''
    if (uniqueCommenters.length <= 3) {
      message = `${uniqueCommenters.join('、')} 留言了你的文章「${preview}」`
    } else {
      message = `${uniqueCommenters.slice(0, 3).join('、')} 和其他人留言了你的文章「${preview}」`
    }

    // 若已有未讀通知就更新，否則新增
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', post.user_id)
      .eq('post_id', postId)
      .eq('type', 'comment')
      .eq('is_read', false)
      .maybeSingle()

    if (existing) {
      await supabase.from('notifications').update({ message }).eq('id', existing.id)
    } else {
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        type: 'comment',
        message,
        post_id: postId
      })
    }
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

        {/* Hashtag 輸入 */}
        <div className="mt-2">
          <div className="flex flex-wrap gap-1 mb-1">
            {tags.map(tag => (
              <span
                key={tag}
                className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full"
              >
                #{tag}
                <button onClick={() => removeTag(tag)} className="text-blue-400 hover:text-blue-600">×</button>
              </span>
            ))}
          </div>
          {tags.length < 5 && (
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagInput}
              placeholder="加標籤，按 Enter 確認（最多5個）"
              className="w-full text-xs text-gray-500 placeholder-gray-300 focus:outline-none"
            />
          )}
        </div>

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
          <div key={post.id} id={`post-${post.id}`} className={`bg-white rounded-2xl border shadow-sm p-4 ${
            highlightPostId === post.id ? 'border-blue-200' : 'border-gray-100'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-200"
                  onClick={() => post.user_id !== profile?.id && onUserClick?.(post.user_id)}
                >
                  {post.profiles?.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-medium text-gray-900 cursor-pointer hover:underline"
                      onClick={() => post.user_id !== profile?.id && onUserClick?.(post.user_id)}
                    >{post.profiles?.username}</span>
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
              {post.user_id === profile?.id && (
                <button
                  onClick={() => deletePost(post.id)}
                  className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                >
                  刪除
                </button>
              )}
            </div>

            <p className="text-sm text-gray-800 leading-relaxed mb-2">{post.content}</p>

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {post.tags.map(tag => (
                  <span
                    key={tag}
                    onClick={() => onTagClick?.(tag)}
                    className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

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
                    <div key={comment.id} id={`comment-${comment.id}`} className="flex gap-2">
                      <div
                        className={`w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0 ${comment.user_id !== profile?.id ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                        onClick={() => comment.user_id !== profile?.id && onUserClick?.(comment.user_id)}
                      >
                        {comment.profiles?.username?.[0]?.toUpperCase()}
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2 flex-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-medium text-gray-700 ${comment.user_id !== profile?.id ? 'cursor-pointer hover:text-gray-900' : ''}`}
                            onClick={() => comment.user_id !== profile?.id && onUserClick?.(comment.user_id)}
                          >{comment.profiles?.username}</span>
                          {comment.user_id === profile?.id && (
                            <button
                              onClick={() => deleteComment(comment.id, post.id)}
                              className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                            >
                              刪除
                            </button>
                          )}
                        </div>
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
