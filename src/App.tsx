import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import PlazaPage from './pages/PlazaPage'
import ProfilePage from './pages/ProfilePage'
import MessagesPage from './pages/MessagesPage'
import NotificationPage from './pages/NotificationPage'
import UserProfilePage from './pages/UserProfilePage'
import ConversationListPage from './pages/ConversationListPage'
import ChatPage from './pages/ChatPage'
import { supabase } from './supabase'

type Tab = 'home' | 'plaza' | 'messages' | 'notifications' | 'profile'

type AppView =
  | { type: 'tabs' }
  | { type: 'userProfile'; userId: string }
  | { type: 'conversationList' }
  | { type: 'chat'; conversationId: string; otherUserId: string; otherUsername: string }

function AppContent() {
  const { isLoggedIn, isLoading, profile } = useApp()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [unreadCount, setUnreadCount] = useState(0)
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null)
  const [viewStack, setViewStack] = useState<AppView[]>([{ type: 'tabs' }])
  const [homeTriggerSearch, setHomeTriggerSearch] = useState<{ query: string; type: 'posts' | 'tags' | 'users' } | null>(null)

  const currentView = viewStack[viewStack.length - 1]
  const isOnTabs = currentView.type === 'tabs'

  const navigate = (view: AppView) => setViewStack(prev => [...prev, view])
  const goBack = () => setViewStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)

  useEffect(() => {
    if (!profile) return
    fetchUnreadCount()
    const channel = supabase
      .channel('unread-notifications')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, () => fetchUnreadCount())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile])

  const fetchUnreadCount = async () => {
    if (!profile) return
    const { count } = await supabase
      .from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('is_read', false)
    setUnreadCount(count || 0)
  }

  const goToSearch = (query: string, type: 'posts' | 'tags' | 'users' = 'tags') => {
    setViewStack([{ type: 'tabs' }])
    setActiveTab('home')
    setHomeTriggerSearch({ query, type })
  }

  const handleTabChange = (tab: Tab) => {
    setViewStack([{ type: 'tabs' }])
    setActiveTab(tab)
  }

  const handleUserClick = (userId: string) => {
    if (userId === profile?.id) {
      setViewStack([{ type: 'tabs' }])
      setActiveTab('profile')
    } else {
      navigate({ type: 'userProfile', userId })
    }
  }

  const openChat = (conversationId: string, otherUserId: string, otherUsername: string) => {
    navigate({ type: 'chat', conversationId, otherUserId, otherUsername })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">載入中...</p>
      </div>
    )
  }

  if (!isLoggedIn) return <AuthPage />

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部標題 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          {!isOnTabs ? (
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                className="flex items-center justify-center w-8 h-8 -ml-1 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {currentView.type === 'chat' && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                    {currentView.otherUsername[0].toUpperCase()}
                  </div>
                  <span className="font-semibold text-gray-900">{currentView.otherUsername}</span>
                </div>
              )}
              {currentView.type === 'conversationList' && (
                <span className="text-xl font-bold text-gray-900">私訊</span>
              )}
            </div>
          ) : (
            <h1 className="text-xl font-bold text-gray-900">
              {activeTab === 'home' && 'Here'}
              {activeTab === 'plaza' && '廣場'}
              {activeTab === 'messages' && '私訊'}
              {activeTab === 'notifications' && '通知'}
              {activeTab === 'profile' && '我的'}
            </h1>
          )}
        </div>
      </div>

      {/* 頁面內容 */}
      <div className="pb-20">
        {currentView.type === 'userProfile' && (
          <UserProfilePage
            userId={currentView.userId}
            onTagClick={(tag) => goToSearch(tag, 'tags')}
            onUserClick={handleUserClick}
            onStartChat={openChat}
          />
        )}
        {currentView.type === 'conversationList' && (
          <ConversationListPage onStartChat={openChat} onUserClick={handleUserClick} />
        )}
        {currentView.type === 'chat' && (
          <ChatPage conversationId={currentView.conversationId} otherUserId={currentView.otherUserId} />
        )}
        {isOnTabs && (
          <>
            {activeTab === 'home' && (
              <HomePage
                onTagClick={(tag) => goToSearch(tag, 'tags')}
                onUserClick={handleUserClick}
                highlightPostId={highlightPostId}
                triggerSearch={homeTriggerSearch}
              />
            )}
            {activeTab === 'plaza' && <PlazaPage onUserClick={handleUserClick} />}
            {activeTab === 'messages' && (
              <MessagesPage onStartChat={openChat} onUserClick={handleUserClick} />
            )}
            {activeTab === 'notifications' && (
              <NotificationPage onPostClick={(postId) => {
                setHighlightPostId(postId)
                setViewStack([{ type: 'tabs' }])
                setActiveTab('home')
              }} />
            )}
            {activeTab === 'profile' && <ProfilePage />}
          </>
        )}
      </div>

      {/* 底部導航 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-2 flex justify-around">
          <button
            onClick={() => handleTabChange('home')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${activeTab === 'home' && isOnTabs ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <span className="text-xl">🏠</span>
            <span className="text-xs font-medium">首頁</span>
          </button>
          <button
            onClick={() => handleTabChange('plaza')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${activeTab === 'plaza' && isOnTabs ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <span className="text-xl">🟢</span>
            <span className="text-xs font-medium">廣場</span>
          </button>
          <button
            onClick={() => handleTabChange('messages')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${activeTab === 'messages' && isOnTabs ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <span className="text-xl">💬</span>
            <span className="text-xs font-medium">私訊</span>
          </button>
          <button
            onClick={() => handleTabChange('notifications')}
            className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${activeTab === 'notifications' && isOnTabs ? 'text-gray-900' : 'text-gray-400'}`}
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
            onClick={() => handleTabChange('profile')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${activeTab === 'profile' && isOnTabs ? 'text-gray-900' : 'text-gray-400'}`}
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
