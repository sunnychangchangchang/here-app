import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import type { Post, Profile } from '../types'

type SearchTab = 'posts' | 'tags' | 'users'

interface SearchPageProps {
  initialQuery?: string
  initialType?: 'posts' | 'tags' | 'users'
}

export default function SearchPage({ initialQuery = '', initialType = 'posts' }: SearchPageProps) {
  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<SearchTab>(initialType)
  const [posts, setPosts] = useState<Post[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialQuery) search()
  }, [])

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)

    if (activeTab === 'posts') {
      const { data } = await supabase
        .from('posts')
        .select('*, profiles(username, language, is_available)')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20)
      setPosts(data || [])
    } else if (activeTab === 'tags') {
      const { data } = await supabase
        .from('posts')
        .select('*, profiles(username, language, is_available)')
        .contains('tags', [query.replace(/^#/, '')])
        .order('created_at', { ascending: false })
        .limit(20)
      setPosts(data || [])
    } else if (activeTab === 'users') {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(20)
      setUsers(data || [])
    }

    setLoading(false)
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
      {/* 搜尋框 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder={
            activeTab === 'tags' ? '搜尋標籤，例如：聊天' :
            activeTab === 'users' ? '搜尋用戶名稱' :
            '搜尋文章內容'
          }
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
        <button
          onClick={search}
          disabled={loading}
          className="bg-gray-900 text-white px-4 py-3 rounded-xl text-sm disabled:opacity-40"
        >
          搜尋
        </button>
      </div>

      {/* Tab */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        {(['posts', 'tags', 'users'] as SearchTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPosts([]); setUsers([]) }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            {tab === 'posts' ? '📝 文章' : tab === 'tags' ? '🏷️ 標籤' : '👤 用戶'}
          </button>
        ))}
      </div>

      {/* 結果 */}
      {loading && (
        <div className="text-center text-gray-400 text-sm py-8">搜尋中...</div>
      )}

      {/* 文章 / 標籤結果 */}
      {(activeTab === 'posts' || activeTab === 'tags') && (
        <div className="space-y-3">
          {!loading && posts.length === 0 && query && (
            <div className="text-center text-gray-400 text-sm py-8">沒有找到相關結果</div>
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
                  </div>
                  <span className="text-xs text-gray-400">{formatTime(post.created_at)}</span>
                </div>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed mb-2">{post.content}</p>
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {post.tags.map(tag => (
                    <span key={tag} className="text-xs text-blue-500">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 用戶結果 */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          {!loading && users.length === 0 && query && (
            <div className="text-center text-gray-400 text-sm py-8">沒有找到相關用戶</div>
          )}
          {users.map(user => (
            <div key={user.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-base font-medium text-gray-600">
                  {user.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{user.username}</span>
                    {user.is_available && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">有空</span>
                    )}
                  </div>
                  {user.bio && <p className="text-xs text-gray-400 mt-0.5">{user.bio}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}