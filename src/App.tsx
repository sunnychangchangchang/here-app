import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import PlazaPage from './pages/PlazaPage'
import ProfilePage from './pages/ProfilePage'
import SearchPage from './pages/SearchPage'
import NotificationPage from './pages/NotificationPage'
import { supabase } from './supabase'

type Tab = 'home' | 'plaza' | 'search' | 'notifications' | 'profile'

function AppContent() {
  const { isLoggedIn, isLoading, profile } = useApp()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<'posts' | 'tags' | 'users'>('posts')
  const [unreadCount, setUnreadCount] = useState(0)
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    fetchUnreadCount()

    const channel = supabase
      .channel('unread-notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, () => fetchUnreadCount())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  const fetchUnreadCount = async () => {
    if (!profile) return
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    setUnreadCount(count || 0)
  }

  const goToSearch = (query: string, type: 'posts' | 'tags' | 'users' = 'tags') => {
    setSearchQuery(query)
    setSearchType(type)
    setActiveTab('search')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">載入中...</p>
      </div>
    )
  }

  if (!isLoggedIn) {
    return <AuthPage />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部標題 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">
            {activeTab === 'home' && 'Here'}
            {activeTab === 'plaza' && '廣場'}
            {activeTab === 'search' && '搜尋'}
            {activeTab === 'notifications' && '通知'}
            {activeTab === 'profile' && '我的'}
          </h1>
        </div>
      </div>

      {/* 頁面內容 */}
      <div className="pb-20">
        {activeTab === 'home' && <HomePage onTagClick={(tag) => goToSearch(tag, 'tags')} highlightPostId={highlightPostId} />}            {activeTab === 'plaza' && <PlazaPage />}
        {activeTab === 'search' && <SearchPage initialQuery={searchQuery} initialType={searchType} />}
        {activeTab === 'notifications' && (
          <NotificationPage onPostClick={(postId) => {
            setHighlightPostId(postId)
            setActiveTab('home')
          }} />
        )}
        {activeTab === 'profile' && <ProfilePage />}
      </div>

      {/* 底部導航 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-2 flex justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
              activeTab === 'home' ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            <span className="text-xl">🏠</span>
            <span className="text-xs font-medium">首頁</span>
          </button>
          <button
            onClick={() => setActiveTab('plaza')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
              activeTab === 'plaza' ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            <span className="text-xl">🟢</span>
            <span className="text-xs font-medium">廣場</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
              activeTab === 'search' ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            <span className="text-xl">🔍</span>
            <span className="text-xs font-medium">搜尋</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
              activeTab === 'notifications' ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            <span className="text-xs font-medium">通知</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
              activeTab === 'profile' ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            <span className="text-xl">👤</span>
            <span className="text-xs font-medium">我的</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}