import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Post, Profile } from '../types'
import { HeartIcon, PostIcon, TagIcon, UserIcon } from '../components/icons'
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
  const [expireHours, setExpireHours] = useState<1 | 8 | 12>(8)
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all')
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTab, setSearchTab] = useState<'posts' | 'tags' | 'users'>('posts')
  const [searchPosts, setSearchPosts] = useState<Post[]>([])
  const [searchUsers, setSearchUsers] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [postLikes, setPostLikes] = useState<Record<string, number>>({})
  const [userLikedPosts, setUserLikedPosts] = useState<Set<string>>(new Set())
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  // 對話請求
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [showReplyFor, setShowReplyFor] = useState<string | null>(null)
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set())
  const [sendingRequest, setSendingRequest] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts(feedFilter)
  }, [feedFilter])

  useEffect(() => {
    const postChannel = supabase
      .channel('posts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts(feedFilter))
      .subscribe()
    return () => { supabase.removeChannel(postChannel) }
  }, [])

  useEffect(() => {
    if (!triggerSearch) return
    setShowSearch(true)
    setSearchQuery(triggerSearch.query)
    setSearchTab(triggerSearch.type)
    performSearch(triggerSearch.query, triggerSearch.type)
  }, [triggerSearch])

  useEffect(() => {
    if (showSearch && searchInputRef.current) searchInputRef.current.focus()
  }, [showSearch])

  useEffect(() => {
    if (!highlightPostId) return
    setTimeout(() => {
      document.getElementById(`post-${highlightPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 300)
  }, [highlightPostId])

  const fetchPosts = async (filter: 'all' | 'following' = 'all') => {
    let userIds: string[] | null = null
    if (filter === 'following' && profile) {
      const { data: follows } = await supabase
        .from('follows').select('following_id').eq('follower_id', profile.id)
      userIds = (follows || []).map(f => f.following_id)
      if (userIds.length === 0) { setPosts([]); return }
    }

    let query = supabase
      .from('posts')
      .select('*, profiles(username, language, is_available)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(50)
    if (userIds) query = query.in('user_id', userIds)

    const { data } = await query
    if (data) {
      setPosts(data)
      fetchPostLikes(data.map(p => p.id))
      if (profile) fetchSentRequests(data.map(p => p.id))
    }
  }

  const fetchPostLikes = async (postIds: string[]) => {
    if (!postIds.length || !profile) return
    const { data } = await supabase
      .from('post_likes').select('post_id, user_id').in('post_id', postIds)
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

  const fetchSentRequests = async (postIds: string[]) => {
    if (!postIds.length || !profile) return
    const { data } = await supabase
      .from('conversation_requests')
      .select('post_id')
      .eq('sender_id', profile.id)
      .in('post_id', postIds)
    if (data) setSentRequests(new Set(data.map(r => r.post_id)))
  }

  const togglePostLike = async (postId: string) => {
    if (!profile) return
    const isLiked = userLikedPosts.has(postId)
    setUserLikedPosts(prev => { const next = new Set(prev); isLiked ? next.delete(postId) : next.add(postId); return next })
    setPostLikes(prev => ({ ...prev, [postId]: Math.max((prev[postId] || 0) + (isLiked ? -1 : 1), 0) }))
    if (isLiked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', profile.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: profile.id })
    }
  }

  const submitRequest = async (post: Post) => {
    const message = replyInputs[post.id]?.trim()
    if (!message || !profile) return
    setSendingRequest(true)
    const { error } = await supabase.from('conversation_requests').insert({
      post_id: post.id,
      sender_id: profile.id,
      receiver_id: post.user_id,
      message,
    })
    if (!error) {
      setSentRequests(prev => new Set(prev).add(post.id))
      setReplyInputs(prev => ({ ...prev, [post.id]: '' }))
      setShowReplyFor(null)
      // 通知對方
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        type: 'conversation_request',
        message: `${profile.username} 想和你聊聊`,
        post_id: post.id,
      })
    }
    setSendingRequest(false)
  }

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const tag = tagInput.trim().replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]/g, '')
      if (tag && !tags.includes(tag) && tags.length < 5) setTags(prev => [...prev, tag])
      setTagInput('')
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const toAdd = files.slice(0, 3 - selectedImages.length)
    setSelectedImages(prev => [...prev, ...toAdd])
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => setImagePreviews(prev => [...prev, ev.target!.result as string])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const submitPost = async () => {
    if ((!newPost.trim() && selectedImages.length === 0) || !profile) return
    setPostError(null)
    // 12小時內最多3篇
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('posts').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id).gte('created_at', twelveHoursAgo)
    if ((count || 0) >= 3) {
      setPostError('12 小時內最多發 3 篇，等等再來')
      return
    }
    setLoading(true)
    setUploadingImages(selectedImages.length > 0)
    let image_urls: string[] = []
    if (selectedImages.length > 0) {
      image_urls = await Promise.all(selectedImages.map(file => uploadImage(file, 'post-images', profile.id)))
    }
    const expires_at = new Date(Date.now() + expireHours * 60 * 60 * 1000).toISOString()
    await supabase.from('posts').insert({
      user_id: profile.id, content: newPost.trim(),
      waiting_for_reply: false, tags, image_urls, expires_at,
    })
    ;(document.activeElement as HTMLElement)?.blur()
    setNewPost(''); setExpireHours(8); setTags([]); setTagInput('')
    setSelectedImages([]); setImagePreviews([]); setUploadingImages(false); setLoading(false)
  }

  const deletePost = async (postId: string) => {
    if (!profile) return
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', profile.id)
    if (!error) setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const performSearch = async (q: string, tab: 'posts' | 'tags' | 'users') => {
    if (!q.trim()) return
    ;(document.activeElement as HTMLElement)?.blur()
    setSearching(true)
    try {
      if (tab === 'posts') {
        const { data } = await supabase.from('posts')
          .select('*, profiles(username, language, is_available)')
          .ilike('content', `%${q}%`).order('created_at', { ascending: false }).limit(20)
        setSearchPosts(data || []); setSearchUsers([])
      } else if (tab === 'tags') {
        const { data } = await supabase.from('posts')
          .select('*, profiles(username, language, is_available)')
          .contains('tags', [q.replace(/^#/, '')]).order('created_at', { ascending: false }).limit(20)
        setSearchPosts(data || []); setSearchUsers([])
      } else {
        const { data } = await supabase.from('profiles').select('*').ilike('username', `%${q}%`).limit(20)
        setSearchUsers(data || []); setSearchPosts([])
      }
    } finally {
      setSearching(false)
    }
  }

  const clearSearch = () => { setShowSearch(false); setSearchQuery(''); setSearchPosts([]); setSearchUsers([]) }

  const formatTime = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '剛剛'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
    return `${Math.floor(diff / 86400)} 天前`
  }

  const formatExpiry = (expiresAt: string) => {
    const mins = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000)
    if (mins <= 0) return null
    if (mins < 60) return `${mins} 分鐘後消失`
    return `${Math.floor(mins / 60)} 小時後消失`
  }

  const PostCard = ({ post }: { post: Post }) => {
    const isOwn = post.user_id === profile?.id
    const hasSent = sentRequests.has(post.id)
    const isShowingReply = showReplyFor === post.id

    return (
      <div key={post.id} id={`post-${post.id}`} className={`bg-white rounded-2xl border shadow-sm shadow-gray-100/60 p-4 transition-all duration-200 ${
        highlightPostId === post.id ? 'border-blue-200 shadow-blue-100/40' : 'border-gray-100'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-200"
              onClick={() => !isOwn && onUserClick?.(post.user_id)}
            >
              {post.profiles?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-medium text-gray-900 cursor-pointer hover:underline"
                  onClick={() => !isOwn && onUserClick?.(post.user_id)}
                >{post.profiles?.username}</span>
                {post.profiles?.is_available && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">有空</span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {formatTime(post.created_at)}
                {post.expires_at && formatExpiry(post.expires_at) && (
                  <span className="ml-1.5 text-orange-400">· {formatExpiry(post.expires_at)}</span>
                )}
              </span>
            </div>
          </div>
          {isOwn && (
            <button onClick={() => deletePost(post.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">
              刪除
            </button>
          )}
        </div>

        {post.content && <p className="text-sm text-gray-800 leading-relaxed mb-2">{post.content}</p>}

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
                <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              </div>
            ))}
          </div>
        )}

        {post.tags?.length > 0 && (
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

          {/* 回覆按鈕 — 只對別人的文章顯示 */}
          {!isOwn && (
            hasSent ? (
              <span className="text-xs text-gray-400">已發送請求</span>
            ) : (
              <button
                onClick={() => setShowReplyFor(isShowingReply ? null : post.id)}
                className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
              >
                {isShowingReply ? '取消' : '回覆'}
              </button>
            )
          )}
        </div>

        {/* 回覆輸入框 */}
        {isShowingReply && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex gap-2">
            <input
              type="text"
              value={replyInputs[post.id] || ''}
              onChange={e => setReplyInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && submitRequest(post)}
              placeholder={`傳訊息給 ${post.profiles?.username}...`}
              autoFocus
              className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-200"
            />
            <button
              onClick={() => submitRequest(post)}
              disabled={!replyInputs[post.id]?.trim() || sendingRequest}
              className="text-xs bg-gray-900 text-white px-3 py-2 rounded-xl disabled:opacity-40"
            >
              送出
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* 追蹤 / 所有人 切換 */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        {(['all', 'following'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFeedFilter(f)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
              feedFilter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            {f === 'all' ? '所有人' : '追蹤的人'}
          </button>
        ))}
      </div>

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
                <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 cursor-pointer"
                  onClick={() => post.user_id !== profile?.id && onUserClick?.(post.user_id)}>
                  {post.profiles?.username?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900 cursor-pointer hover:underline"
                  onClick={() => post.user_id !== profile?.id && onUserClick?.(post.user_id)}>
                  {post.profiles?.username}
                </span>
                <span className="text-xs text-gray-400 ml-auto">{formatTime(post.created_at)}</span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed mb-2">{post.content}</p>
              {post.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {post.tags.map(tag => (
                    <span key={tag} onClick={() => onTagClick?.(tag)} className="text-xs text-blue-500 cursor-pointer hover:text-blue-700">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {searchTab === 'users' && searchUsers.map(user => (
            <div key={user.id} onClick={() => onUserClick?.(user.id)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer">
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100/60 p-4 mb-6">
        <textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder="你在想什麼？有問題想找人聊聊嗎？"
          className="w-full text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none"
          rows={3}
        />
        {imagePreviews.length > 0 && (
          <div className="flex gap-2 mt-3">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative w-20 h-20 flex-shrink-0">
                <img src={src} className="w-full h-full object-cover rounded-xl" />
                <button onClick={() => { setSelectedImages(p => p.filter((_, j) => j !== i)); setImagePreviews(p => p.filter((_, j) => j !== i)) }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full text-xs flex items-center justify-center">×</button>
              </div>
            ))}
            {selectedImages.length < 3 && (
              <button onClick={() => imageInputRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 min-h-[28px]">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-0.5 text-xs bg-blue-50 text-blue-500 px-2.5 py-1 rounded-full">
              #{tag}
              <button onClick={() => setTags(p => p.filter(t => t !== tag))} className="ml-0.5 text-blue-300 hover:text-blue-500 leading-none">×</button>
            </span>
          ))}
          {tags.length < 5 && (
            <div className="flex items-center text-gray-400">
              <span className="text-xs select-none">#</span>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                onKeyDown={handleTagInput}
                placeholder={tags.length === 0 ? '加標籤，Enter 確認' : '繼續加...'}
                className="text-xs text-gray-600 placeholder-gray-300 focus:outline-none ml-0.5 w-32"
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-2">
            {selectedImages.length === 0 && (
              <button onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                照片
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-300">消失</span>
              <div className="flex gap-1">
                {([1, 8, 12] as const).map(h => (
                  <button key={h} onClick={() => setExpireHours(h)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-all ${expireHours === h ? 'bg-orange-100 text-orange-500 font-medium' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            <button onClick={submitPost} disabled={loading || uploadingImages || (!newPost.trim() && selectedImages.length === 0)}
              className="bg-gray-900 text-white text-xs px-4 py-1.5 rounded-full disabled:opacity-40 hover:bg-gray-700 transition-colors">
              {uploadingImages ? '上傳中...' : '發布'}
            </button>
          </div>
        </div>
        {postError && (
          <p className="mt-2 text-xs text-red-400 text-center">{postError}</p>
        )}
        <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
      </div>

      {/* 文章列表 */}
      {!showSearch && (
        <div className="space-y-3">
          {posts.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12">還沒有人發文，來第一個吧</div>
          )}
          {posts.map(post => <PostCard key={post.id} post={post} />)}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setLightbox(null)}
          onTouchStart={e => { (e.currentTarget as any)._touchStartX = e.touches[0].clientX }}
          onTouchEnd={e => {
            const diff = (e.currentTarget as any)._touchStartX - e.changedTouches[0].clientX
            if (Math.abs(diff) > 50) {
              if (diff > 0 && lightbox.index < lightbox.urls.length - 1) setLightbox(p => p && { ...p, index: p.index + 1 })
              else if (diff < 0 && lightbox.index > 0) setLightbox(p => p && { ...p, index: p.index - 1 })
            }
          }}
        >
          <img src={lightbox.urls[lightbox.index]} className="max-w-full max-h-full object-contain p-4" onClick={e => e.stopPropagation()} />
          {lightbox.index > 0 && (
            <button onClick={e => { e.stopPropagation(); setLightbox(p => p && { ...p, index: p.index - 1 }) }}
              className="absolute left-4 w-10 h-10 bg-white/20 text-white rounded-full hidden sm:flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          {lightbox.index < lightbox.urls.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setLightbox(p => p && { ...p, index: p.index + 1 }) }}
              className="absolute right-4 w-10 h-10 bg-white/20 text-white rounded-full hidden sm:flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
          {lightbox.urls.length > 1 && (
            <div className="absolute bottom-8 flex gap-2">
              {lightbox.urls.map((_, i) => (
                <div key={i} className={`rounded-full transition-all ${i === lightbox.index ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
              ))}
            </div>
          )}
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-9 h-9 bg-white/20 text-white rounded-full flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
