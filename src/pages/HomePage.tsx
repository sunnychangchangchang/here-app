import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Post, Comment, Profile } from '../types'
import { CommentIcon, HeartIcon, PostIcon, StatusIcon, TagIcon, UserIcon } from '../components/icons'
import { uploadImage } from '../utils/imageUtils'

interface HomePageProps {
  onTagClick?: (tag: string) => void
  onUserClick?: (userId: string) => void
  highlightPostId?: string | null
  triggerSearch?: { query: string; type: 'posts' | 'tags' | 'users' } | null
}

export default function HomePage({ onTagClick, onUserClick, highlightPostId, triggerSearch }: HomePageProps) {
  const { profile } = useApp()
  const [posts, setPosts] = useState<Post[]>([])
  const [newPost, setNewPost] = useState('')
  const [waitingForReply, setWaitingForReply] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTab, setSearchTab] = useState<'posts' | 'tags' | 'users'>('posts')
  const [searchPosts, setSearchPosts] = useState<Post[]>([])
  const [searchUsers, setSearchUsers] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const [scrollToLastCommentPostId, setScrollToLastCommentPostId] = useState<string | null>(null)
  const [postLikes, setPostLikes] = useState<Record<string, number>>({})
  const [userLikedPosts, setUserLikedPosts] = useState<Set<string>>(new Set())
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({})
  const [userLikedComments, setUserLikedComments] = useState<Set<string>>(new Set())

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
    if (!triggerSearch) return
    setShowSearch(true)
    setSearchQuery(triggerSearch.query)
    setSearchTab(triggerSearch.type)
    performSearch(triggerSearch.query, triggerSearch.type)
  }, [triggerSearch])

  const performSearch = async (q: string, tab: 'posts' | 'tags' | 'users') => {
    if (!q.trim()) return
    setSearching(true)
    if (tab === 'posts') {
      const { data } = await supabase
        .from('posts').select('*, profiles(username, language, is_available)')
        .ilike('content', `%${q}%`).order('created_at', { ascending: false }).limit(20)
      setSearchPosts(data || [])
      setSearchUsers([])
    } else if (tab === 'tags') {
      const { data } = await supabase
        .from('posts').select('*, profiles(username, language, is_available)')
        .contains('tags', [q.replace(/^#/, '')]).order('created_at', { ascending: false }).limit(20)
      setSearchPosts(data || [])
      setSearchUsers([])
    } else {
      const { data } = await supabase
        .from('profiles').select('*').ilike('username', `%${q}%`).limit(20)
      setSearchUsers(data || [])
      setSearchPosts([])
    }
    setSearching(false)
  }

  const clearSearch = () => {
    setShowSearch(false)
    setSearchQuery('')
    setSearchPosts([])
    setSearchUsers([])
  }

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  useEffect(() => {
    if (!highlightPostId) return
    setExpandedPost(highlightPostId)
    setScrollToLastCommentPostId(highlightPostId)
    fetchComments(highlightPostId)
    setTimeout(() => {
      document.getElementById(`post-${highlightPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 300)
  }, [highlightPostId])

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
      fetchPostLikes(data.map(p => p.id))
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
    if (data) {
      setComments(prev => ({ ...prev, [postId]: data }))
      fetchCommentLikes(data.map(c => c.id))
    }
  }

  const fetchPostLikes = async (postIds: string[]) => {
    if (!postIds.length || !profile) return
    const { data } = await supabase
      .from('post_likes')
      .select('post_id, user_id')
      .in('post_id', postIds)
    if (!data) return
    const counts: Record<string, number> = {}
    const liked = new Set<string>()
    for (const like of data) {
      counts[like.post_id] = (counts[like.post_id] || 0) + 1
      if (like.user_id === profile.id) liked.add(like.post_id)
    }
    setPostLikes(counts)
    setUserLikedPosts(liked)
  }

  const fetchCommentLikes = async (commentIds: string[]) => {
    if (!commentIds.length || !profile) return
    const { data } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', commentIds)
    if (!data) return
    const counts: Record<string, number> = {}
    const liked = new Set<string>()
    for (const like of data) {
      counts[like.comment_id] = (counts[like.comment_id] || 0) + 1
      if (like.user_id === profile.id) liked.add(like.comment_id)
    }
    setCommentLikes(prev => ({ ...prev, ...counts }))
    setUserLikedComments(prev => {
      const next = new Set(prev)
      liked.forEach(id => next.add(id))
      return next
    })
  }

  const togglePostLike = async (postId: string) => {
    if (!profile) return
    const isLiked = userLikedPosts.has(postId)
    setUserLikedPosts(prev => {
      const next = new Set(prev)
      isLiked ? next.delete(postId) : next.add(postId)
      return next
    })
    setPostLikes(prev => ({ ...prev, [postId]: Math.max((prev[postId] || 0) + (isLiked ? -1 : 1), 0) }))
    if (isLiked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', profile.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: profile.id })
    }
  }

  const toggleCommentLike = async (commentId: string) => {
    if (!profile) return
    const isLiked = userLikedComments.has(commentId)
    setUserLikedComments(prev => {
      const next = new Set(prev)
      isLiked ? next.delete(commentId) : next.add(commentId)
      return next
    })
    setCommentLikes(prev => ({ ...prev, [commentId]: Math.max((prev[commentId] || 0) + (isLiked ? -1 : 1), 0) }))
    if (isLiked) {
      await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', profile.id)
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: profile.id })
    }
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const remaining = 3 - selectedImages.length
    const toAdd = files.slice(0, remaining)
    setSelectedImages(prev => [...prev, ...toAdd])
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => setImagePreviews(prev => [...prev, ev.target!.result as string])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removeSelectedImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const submitPost = async () => {
    if ((!newPost.trim() && selectedImages.length === 0) || !profile) return
    setLoading(true)
    setUploadingImages(selectedImages.length > 0)

    let image_urls: string[] = []
    if (selectedImages.length > 0) {
      image_urls = await Promise.all(
        selectedImages.map(file => uploadImage(file, 'post-images', profile.id))
      )
    }

    await supabase.from('posts').insert({
      user_id: profile.id,
      content: newPost.trim(),
      waiting_for_reply: waitingForReply,
      tags,
      image_urls
    })
    setNewPost('')
    setWaitingForReply(false)
    setTags([])
    setTagInput('')
    setSelectedImages([])
    setImagePreviews([])
    setUploadingImages(false)
    setLoading(false)
  }

  const deletePost = async (postId: string) => {
    if (!profile) return
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', profile.id)
    if (error) return
    setPosts(prev => prev.filter(post => post.id !== postId))
    setComments(prev => { const next = { ...prev }; delete next[postId]; return next })
    setCommentCounts(prev => { const next = { ...prev }; delete next[postId]; return next })
    setNewComment(prev => { const next = { ...prev }; delete next[postId]; return next })
    if (expandedPost === postId) setExpandedPost(null)
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
      .from('comments')
      .select('user_id, profiles(username)')
      .eq('post_id', postId)
      .neq('user_id', post.user_id)

    const seen = new Set<string>()
    const uniqueCommenters: string[] = []
    for (const c of allComments || []) {
      const username = (c.profiles as any)?.username
      if (username && !seen.has(username)) { seen.add(username); uniqueCommenters.push(username) }
    }

    const preview = post.content.length > 20 ? post.content.slice(0, 20) + '...' : post.content
    const message = uniqueCommenters.length <= 3
      ? `${uniqueCommenters.join('、')} 留言了你的文章「${preview}」`
      : `${uniqueCommenters.slice(0, 3).join('、')} 和其他人留言了你的文章「${preview}」`

    const { data: existing } = await supabase
      .from('notifications').select('id')
      .eq('user_id', post.user_id).eq('post_id', postId)
      .eq('type', 'comment').eq('is_read', false).maybeSingle()

    if (existing) {
      await supabase.from('notifications').update({ message }).eq('id', existing.id)
    } else {
      await supabase.from('notifications').insert({ user_id: post.user_id, type: 'comment', message, post_id: postId })
    }
  }

  const formatTime = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '剛剛'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
    return `${Math.floor(diff / 86400)} 天前`
  }

  const formatTimeSearch = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '剛剛'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
    return `${Math.floor(diff / 86400)} 天前`
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* 搜尋列 */}
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-400 hover:border-gray-300 transition-colors mb-4"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          搜尋文章、標籤或用戶...
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
          <div className="flex gap-2 mb-3">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && performSearch(searchQuery, searchTab)}
              placeholder={searchTab === 'tags' ? '搜尋標籤...' : searchTab === 'users' ? '搜尋用戶...' : '搜尋文章...'}
              className="flex-1 text-sm focus:outline-none"
            />
            <button onClick={clearSearch} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(['posts', 'tags', 'users'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setSearchTab(tab); setSearchPosts([]); setSearchUsers([]) }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  searchTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {tab === 'posts' ? <PostIcon /> : tab === 'tags' ? <TagIcon /> : <UserIcon className="w-4 h-4" />}
                  {tab === 'posts' ? '文章' : tab === 'tags' ? '標籤' : '用戶'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 搜尋結果 */}
      {showSearch && (searchPosts.length > 0 || searchUsers.length > 0 || searching) && (
        <div className="space-y-3 mb-6">
          {searching && <p className="text-center text-gray-400 text-sm py-4">搜尋中...</p>}
          {(searchTab === 'posts' || searchTab === 'tags') && searchPosts.map(post => (
            <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200"
                  onClick={() => post.user_id !== profile?.id && onUserClick?.(post.user_id)}
                >
                  {post.profiles?.username?.[0]?.toUpperCase()}
                </div>
                <span
                  className="text-sm font-medium text-gray-900 cursor-pointer hover:underline"
                  onClick={() => post.user_id !== profile?.id && onUserClick?.(post.user_id)}
                >{post.profiles?.username}</span>
                <span className="text-xs text-gray-400 ml-auto">{formatTimeSearch(post.created_at)}</span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed mb-2">{post.content}</p>
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {post.tags.map(tag => (
                    <span key={tag} onClick={() => onTagClick?.(tag)} className="text-xs text-blue-500 cursor-pointer hover:text-blue-700">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {searchTab === 'users' && searchUsers.map(user => (
            <div
              key={user.id}
              onClick={() => onUserClick?.(user.id)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-base font-medium text-gray-600">
                {user.username[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{user.username}</span>
                  {user.is_available && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">有空</span>}
                </div>
                {user.bio && <p className="text-xs text-gray-400 mt-0.5">{user.bio}</p>}
              </div>
            </div>
          ))}
          {!searching && searchQuery && searchPosts.length === 0 && searchUsers.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-6">沒有找到相關結果</p>
          )}
        </div>
      )}

      {/* 發文框 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder="你在想什麼？有問題想找人聊聊嗎？"
          className="w-full text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none"
          rows={3}
        />

        {/* 圖片預覽 */}
        {imagePreviews.length > 0 && (
          <div className="flex gap-2 mt-3">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative w-20 h-20 flex-shrink-0">
                <img src={src} className="w-full h-full object-cover rounded-xl" />
                <button
                  onClick={() => removeSelectedImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full text-xs flex items-center justify-center hover:bg-gray-600"
                >×</button>
              </div>
            ))}
            {selectedImages.length < 3 && (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-gray-300 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="mt-2">
          <div className="flex flex-wrap gap-1 mb-1">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWaitingForReply(!waitingForReply)}
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full transition-all ${
                waitingForReply ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <StatusIcon active={waitingForReply} className="w-3.5 h-3.5" />
              在線等回覆
            </button>
            {selectedImages.length === 0 && (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                照片
              </button>
            )}
          </div>
          <button
            onClick={submitPost}
            disabled={loading || uploadingImages || (!newPost.trim() && selectedImages.length === 0)}
            className="bg-gray-900 text-white text-xs px-4 py-1.5 rounded-full disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            {uploadingImages ? '上傳中...' : '發布'}
          </button>
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
      </div>

      {/* 文章列表 */}
      <div className="space-y-3">
        {posts.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">還沒有人發文，來第一個吧</div>
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
                <button onClick={() => deletePost(post.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">
                  刪除
                </button>
              )}
            </div>

            {post.content && <p className="text-sm text-gray-800 leading-relaxed mb-2">{post.content}</p>}

            {/* 圖片 */}
            {post.image_urls?.length > 0 && (
              <div className={`flex gap-1.5 mb-3 ${post.image_urls.length === 1 ? 'justify-start' : ''}`}>
                {post.image_urls.map((url, i) => (
                  <div
                    key={i}
                    onClick={() => setLightbox({ urls: post.image_urls, index: i })}
                    className={`relative overflow-hidden rounded-xl cursor-pointer group flex-shrink-0 ${
                      post.image_urls.length === 1 ? 'w-48 h-48' : 'w-24 h-24'
                    }`}
                  >
                    <img
                      src={url}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                ))}
              </div>
            )}

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
              <button
                onClick={() => togglePostLike(post.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                <HeartIcon filled={userLikedPosts.has(post.id)} className="w-4 h-4" />
                {postLikes[post.id] ? <span>{postLikes[post.id]}</span> : null}
              </button>
              <button
                onClick={() => toggleComments(post.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <CommentIcon className="w-4 h-4" />
                {commentCounts[post.id] ? `· ${commentCounts[post.id]}` : '留言'}
              </button>
            </div>

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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleCommentLike(comment.id)}
                              className="flex items-center gap-0.5 text-xs text-gray-300 hover:text-red-400 transition-colors"
                            >
                              <HeartIcon filled={userLikedComments.has(comment.id)} className="w-3.5 h-3.5" />
                              {commentLikes[comment.id] ? <span>{commentLikes[comment.id]}</span> : null}
                            </button>
                            {comment.user_id === profile?.id && (
                              <button onClick={() => deleteComment(comment.id, post.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">
                                刪除
                              </button>
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
                    type="text"
                    value={newComment[post.id] || ''}
                    onChange={e => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && submitComment(post.id)}
                    placeholder="留言..."
                    className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-200"
                  />
                  <button onClick={() => submitComment(post.id)} className="text-xs bg-gray-900 text-white px-3 py-2 rounded-xl">
                    送出
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setLightbox(null)}
          onTouchStart={e => {
            const t = e.touches[0]
            ;(e.currentTarget as any)._touchStartX = t.clientX
          }}
          onTouchEnd={e => {
            const startX = (e.currentTarget as any)._touchStartX
            const endX = e.changedTouches[0].clientX
            const diff = startX - endX
            if (Math.abs(diff) > 50) {
              if (diff > 0 && lightbox.index < lightbox.urls.length - 1) {
                setLightbox(prev => prev && { ...prev, index: prev.index + 1 })
              } else if (diff < 0 && lightbox.index > 0) {
                setLightbox(prev => prev && { ...prev, index: prev.index - 1 })
              }
            }
          }}
        >
          <img
            src={lightbox.urls[lightbox.index]}
            className="max-w-full max-h-full object-contain p-4"
            onClick={e => e.stopPropagation()}
          />
          {/* 左右箭頭（桌面版） */}
          {lightbox.index > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(prev => prev && { ...prev, index: prev.index - 1 }) }}
              className="absolute left-4 w-10 h-10 bg-white/20 text-white rounded-full hidden sm:flex items-center justify-center hover:bg-white/30"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {lightbox.index < lightbox.urls.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(prev => prev && { ...prev, index: prev.index + 1 }) }}
              className="absolute right-4 w-10 h-10 bg-white/20 text-white rounded-full hidden sm:flex items-center justify-center hover:bg-white/30"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          {/* 頁數指示點 */}
          {lightbox.urls.length > 1 && (
            <div className="absolute bottom-8 flex gap-2">
              {lightbox.urls.map((_, i) => (
                <div key={i} className={`rounded-full transition-all ${i === lightbox.index ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
              ))}
            </div>
          )}
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-white/20 text-white rounded-full flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
