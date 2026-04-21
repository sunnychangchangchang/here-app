import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Post, Comment, Profile } from '../types'
import { CommentIcon, HeartIcon, StatusIcon } from '../components/icons'

const LANGUAGES = [
  { code: 'zh-TW', label: '繁中', flag: '🇹🇼' },
  { code: 'zh-CN', label: '簡中', flag: '🇨🇳' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
]

interface UserProfilePageProps {
  userId: string
  onTagClick?: (tag: string) => void
  onUserClick?: (userId: string) => void
}

export default function UserProfilePage({ userId, onTagClick, onUserClick }: UserProfilePageProps) {
  const { profile } = useApp()
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [postLikes, setPostLikes] = useState<Record<string, number>>({})
  const [userLikedPosts, setUserLikedPosts] = useState<Set<string>>(new Set())
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({})
  const [userLikedComments, setUserLikedComments] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchUserProfile()
    fetchPosts()
    fetchFollowData()
  }, [userId])

  const fetchUserProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setUserProfile(data)
  }

  const fetchFollowData = async () => {
    if (!profile) return
    const [iFollow, , followers, following] = await Promise.all([
      supabase.from('follows').select('id').eq('follower_id', profile.id).eq('following_id', userId).maybeSingle(),
      supabase.from('follows').select('id').eq('follower_id', userId).eq('following_id', profile.id).maybeSingle(),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ])
    setIsFollowing(!!iFollow.data)
    setFollowerCount(followers.count || 0)
    setFollowingCount(following.count || 0)
  }

  const toggleFollow = async () => {
    if (!profile) return
    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setFollowerCount(prev => wasFollowing ? prev - 1 : prev + 1)
    if (wasFollowing) {
      // 雙向移除：退追蹤對方，同時移除對方對我的追蹤
      await supabase.from('follows').delete()
        .or(`and(follower_id.eq.${profile.id},following_id.eq.${userId}),and(follower_id.eq.${userId},following_id.eq.${profile.id})`)

    } else {
      await supabase.from('follows').insert({ follower_id: profile.id, following_id: userId })
      await supabase.from('notifications').insert({
        user_id: userId, type: 'follow', message: `${profile.username} 開始追蹤你`, post_id: null
      })
    }
  }

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts').select('*, profiles(username, language, is_available)')
      .eq('user_id', userId).order('created_at', { ascending: false })
    if (data) {
      setPosts(data)
      data.forEach(post => fetchCommentCount(post.id))
      fetchPostLikes(data.map(p => p.id))
    }
  }

  const fetchCommentCount = async (postId: string) => {
    const { count } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId)
    setCommentCounts(prev => ({ ...prev, [postId]: count || 0 }))
  }

  const fetchComments = async (postId: string) => {
    const { data } = await supabase
      .from('comments').select('*, profiles(username)').eq('post_id', postId).order('created_at', { ascending: true })
    if (data) { setComments(prev => ({ ...prev, [postId]: data })); fetchCommentLikes(data.map(c => c.id)) }
  }

  const fetchPostLikes = async (postIds: string[]) => {
    if (!postIds.length || !profile) return
    const { data } = await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
    if (!data) return
    const counts: Record<string, number> = {}
    const liked = new Set<string>()
    for (const like of data) {
      counts[like.post_id] = (counts[like.post_id] || 0) + 1
      if (like.user_id === profile.id) liked.add(like.post_id)
    }
    setPostLikes(counts); setUserLikedPosts(liked)
  }

  const fetchCommentLikes = async (commentIds: string[]) => {
    if (!commentIds.length || !profile) return
    const { data } = await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
    if (!data) return
    const counts: Record<string, number> = {}
    const liked = new Set<string>()
    for (const like of data) {
      counts[like.comment_id] = (counts[like.comment_id] || 0) + 1
      if (like.user_id === profile.id) liked.add(like.comment_id)
    }
    setCommentLikes(prev => ({ ...prev, ...counts }))
    setUserLikedComments(prev => { const next = new Set(prev); liked.forEach(id => next.add(id)); return next })
  }

  const togglePostLike = async (postId: string) => {
    if (!profile) return
    const isLiked = userLikedPosts.has(postId)
    setUserLikedPosts(prev => { const next = new Set(prev); isLiked ? next.delete(postId) : next.add(postId); return next })
    setPostLikes(prev => ({ ...prev, [postId]: Math.max((prev[postId] || 0) + (isLiked ? -1 : 1), 0) }))
    if (isLiked) { await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', profile.id) }
    else { await supabase.from('post_likes').insert({ post_id: postId, user_id: profile.id }) }
  }

  const toggleCommentLike = async (commentId: string) => {
    if (!profile) return
    const isLiked = userLikedComments.has(commentId)
    setUserLikedComments(prev => { const next = new Set(prev); isLiked ? next.delete(commentId) : next.add(commentId); return next })
    setCommentLikes(prev => ({ ...prev, [commentId]: Math.max((prev[commentId] || 0) + (isLiked ? -1 : 1), 0) }))
    if (isLiked) { await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', profile.id) }
    else { await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: profile.id }) }
  }

  const toggleComments = (postId: string) => {
    if (expandedPost === postId) { setExpandedPost(null) }
    else { setExpandedPost(postId); fetchComments(postId) }
  }

  const deleteComment = async (commentId: string, postId: string) => {
    if (!profile) return
    setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }))
    setCommentCounts(prev => ({ ...prev, [postId]: Math.max((prev[postId] || 1) - 1, 0) }))
    await supabase.from('comments').delete().eq('id', commentId).eq('user_id', profile.id)
  }

  const submitComment = async (postId: string) => {
    const content = newComment[postId]?.trim()
    if (!content || !profile) return
    await supabase.from('comments').insert({ post_id: postId, user_id: profile.id, content })
    setNewComment(prev => ({ ...prev, [postId]: '' }))
    const post = posts.find(p => p.id === postId)
    if (!post || post.user_id === profile.id) return
    const { data: allComments } = await supabase
      .from('comments').select('user_id, profiles(username)').eq('post_id', postId).neq('user_id', post.user_id)
    const seen = new Set<string>(); const uniqueCommenters: string[] = []
    for (const c of allComments || []) {
      const username = (c.profiles as any)?.username
      if (username && !seen.has(username)) { seen.add(username); uniqueCommenters.push(username) }
    }
    const preview = post.content.length > 20 ? post.content.slice(0, 20) + '...' : post.content
    const message = uniqueCommenters.length <= 3
      ? `${uniqueCommenters.join('、')} 留言了你的文章「${preview}」`
      : `${uniqueCommenters.slice(0, 3).join('、')} 和其他人留言了你的文章「${preview}」`
    const { data: existing } = await supabase
      .from('notifications').select('id').eq('user_id', post.user_id).eq('post_id', postId)
      .eq('type', 'comment').eq('is_read', false).maybeSingle()
    if (existing) { await supabase.from('notifications').update({ message }).eq('id', existing.id) }
    else { await supabase.from('notifications').insert({ user_id: post.user_id, type: 'comment', message, post_id: postId }) }
  }

  const getLanguageLabel = (code: string) => {
    const lang = LANGUAGES.find(l => l.code === code)
    return lang ? `${lang.flag} ${lang.label}` : code
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
      {/* 用戶資料卡 */}
      {userProfile && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl font-semibold text-gray-600 flex-shrink-0">
              {userProfile.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-lg font-bold text-gray-900">{userProfile.username}</span>
                {userProfile.is_available && (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    <StatusIcon active className="w-3 h-3" />
                    有空
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">{getLanguageLabel(userProfile.language)}</span>
              {userProfile.bio && <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{userProfile.bio}</p>}
              <div className="flex gap-4 mt-2.5">
                <span className="text-xs text-gray-500"><span className="font-semibold text-gray-800">{followerCount}</span> 追蹤者</span>
                <span className="text-xs text-gray-500">追蹤 <span className="font-semibold text-gray-800">{followingCount}</span> 人</span>
              </div>
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="flex gap-2">
            <button
              onClick={toggleFollow}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                isFollowing ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              {isFollowing ? '已追蹤' : '追蹤'}
            </button>
          </div>
        </div>
      )}

      {/* 貼文列表 */}
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        貼文 · {posts.length}
      </h3>

      <div className="space-y-3">
        {posts.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">還沒有發過貼文</div>
        )}
        {posts.map(post => (
          <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{formatTime(post.created_at)}</span>
              {post.waiting_for_reply && (
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">在線等</span>
              )}
            </div>
            <p className="text-sm text-gray-800 leading-relaxed mb-2">{post.content}</p>
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {post.tags.map(tag => (
                  <span key={tag} onClick={() => onTagClick?.(tag)} className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4">
              <button onClick={() => togglePostLike(post.id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors">
                <HeartIcon filled={userLikedPosts.has(post.id)} className="w-4 h-4" />
                {postLikes[post.id] ? <span>{postLikes[post.id]}</span> : null}
              </button>
              <button onClick={() => toggleComments(post.id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                <CommentIcon className="w-4 h-4" />
                {commentCounts[post.id] ? `· ${commentCounts[post.id]}` : '留言'}
              </button>
            </div>

            {expandedPost === post.id && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <div className="space-y-2 mb-3">
                  {(comments[post.id] || []).length === 0 && <p className="text-xs text-gray-400">還沒有留言</p>}
                  {(comments[post.id] || []).map(comment => (
                    <div key={comment.id} className="flex gap-2">
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
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleCommentLike(comment.id)} className="flex items-center gap-0.5 text-xs text-gray-300 hover:text-red-400 transition-colors">
                              <HeartIcon filled={userLikedComments.has(comment.id)} className="w-3.5 h-3.5" />
                              {commentLikes[comment.id] ? <span>{commentLikes[comment.id]}</span> : null}
                            </button>
                            {comment.user_id === profile?.id && (
                              <button onClick={() => deleteComment(comment.id, post.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">刪除</button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text" value={newComment[post.id] || ''}
                    onChange={e => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && submitComment(post.id)}
                    placeholder="留言..." className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-200"
                  />
                  <button onClick={() => submitComment(post.id)} className="text-xs bg-gray-900 text-white px-3 py-2 rounded-xl">送出</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
