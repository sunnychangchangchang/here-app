import { useState, useEffect, useRef } from 'react'
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
import { BellIcon, HomeIcon, MessageIcon, PlazaIcon, UserIcon } from './components/icons'

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
  const [unreadDmCount, setUnreadDmCount] = useState(0)
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null)
  const [viewStack, setViewStack] = useState<AppView[]>([{ type: 'tabs' }])
  const [homeTriggerSearch, setHomeTriggerSearch] = useState<{ query: string; type: 'posts' | 'tags' | 'users' } | null>(null)
  const [headerH, setHeaderH] = useState(54)
  const [tabbarH, setTabbarH] = useState(64)
  const [navDir, setNavDir] = useState<'forward' | 'back'>('forward')
  const headerRef = useRef<HTMLDivElement>(null)
  const tabbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (headerRef.current) setHeaderH(headerRef.current.offsetHeight)
    if (tabbarRef.current) setTabbarH(tabbarRef.current.offsetHeight)
  }, [isLoggedIn])

  const currentView = viewStack[viewStack.length - 1]
  const isOnTabs = currentView.type === 'tabs'

  const navigate = (view: AppView) => {
    setNavDir('forward')
    setViewStack(prev => [...prev, view])
  }
  const goBack = () => {
    setNavDir('back')
    setViewStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  }

  useEffect(() => {
    if (!profile) return
    fetchUnreadCount()
    fetchUnreadDmCount()

    const notifChannel = supabase
      .channel('unread-notifications')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, () => fetchUnreadCount())
      .subscribe()

    const dmChannel = supabase
      .channel('unread-dm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchUnreadDmCount())
      .subscribe()

    return () => {
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(dmChannel)
    }
  }, [profile])

  const fetchUnreadCount = async () => {
    if (!profile) return
    const { count } = await supabase
      .from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('is_read', false)
    setUnreadCount(count || 0)
  }

  const fetchUnreadDmCount = async () => {
    if (!profile) return
    const { data: convs } = await supabase
      .from('conversations').select('id')
      .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
    if (!convs?.length) { setUnreadDmCount(0); return }
    const { data: unreadMsgs } = await supabase
      .from('messages').select('conversation_id')
      .in('conversation_id', convs.map(c => c.id))
      .neq('sender_id', profile.id)
      .eq('is_read', false)
    const uniqueConvs = new Set((unreadMsgs || []).map(m => m.conversation_id))
    setUnreadDmCount(uniqueConvs.size)
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
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-2xl bg-gray-900 flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) return <AuthPage />

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* 頂部標題 */}
      <div ref={headerRef} className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 relative flex items-center justify-center min-h-[48px]">
          {!isOnTabs ? (
            <>
              <button
                onClick={goBack}
                className="absolute left-4 flex items-center justify-center w-8 h-8 text-gray-500 active:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {currentView.type === 'chat' && (
                <button
                  onClick={() => handleUserClick(currentView.otherUserId)}
                  className="flex items-center gap-2 active:opacity-60 transition-opacity"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                    {currentView.otherUsername[0].toUpperCase()}
                  </div>
                  <span className="font-semibold text-gray-900">{currentView.otherUsername}</span>
                </button>
              )}
              {currentView.type === 'conversationList' && (
                <span className="text-base font-bold text-gray-900">私訊</span>
              )}
              {currentView.type === 'userProfile' && (
                <span className="text-base font-bold text-gray-900">個人頁面</span>
              )}
            </>
          ) : (
            <h1 className="text-base font-bold text-gray-900">
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
      <div className="pb-20" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        {currentView.type === 'userProfile' && (
          <div key={currentView.userId} className={navDir === 'forward' ? 'anim-slide-right' : 'anim-slide-left'}>
            <UserProfilePage
              userId={currentView.userId}
              onTagClick={(tag) => goToSearch(tag, 'tags')}
              onUserClick={handleUserClick}
            />
          </div>
        )}
        {currentView.type === 'conversationList' && (
          <div key="conv-list" className={navDir === 'forward' ? 'anim-slide-right' : 'anim-slide-left'}>
            <ConversationListPage onStartChat={openChat} onUserClick={handleUserClick} />
          </div>
        )}
        {currentView.type === 'chat' && (
          <div key={currentView.conversationId} className="anim-fade">
            <ChatPage
              conversationId={currentView.conversationId}
              otherUserId={currentView.otherUserId}
              onUserClick={handleUserClick}
              headerH={headerH}
              tabbarH={tabbarH}
            />
          </div>
        )}
        {/* Tab 頁面保持 mounted，切換用 opacity transition，避免重複 fetch */}
        <div className={`relative ${isOnTabs ? '' : 'hidden'}`}>
          {(['home', 'plaza', 'messages', 'notifications', 'profile'] as Tab[]).map(tab => (
            <div
              key={tab}
              className={`tab-panel ${activeTab === tab ? 'tab-panel-visible' : 'tab-panel-hidden'}`}
            >
              {tab === 'home' && (
                <HomePage
                  onTagClick={(tag) => goToSearch(tag, 'tags')}
                  onUserClick={handleUserClick}
                  highlightPostId={highlightPostId}
                  triggerSearch={homeTriggerSearch}
                />
              )}
              {tab === 'plaza' && <PlazaPage onUserClick={handleUserClick} />}
              {tab === 'messages' && (
                <MessagesPage onStartChat={openChat} onUserClick={handleUserClick} />
              )}
              {tab === 'notifications' && (
                <NotificationPage
                  onPostClick={(postId) => {
                    setHighlightPostId(postId)
                    setViewStack([{ type: 'tabs' }])
                    setActiveTab('home')
                  }}
                  onStartChat={openChat}
                />
              )}
              {tab === 'profile' && <ProfilePage />}
            </div>
          ))}
        </div>
      </div>

      {/* 底部導航 */}
      <div ref={tabbarRef} className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100/80" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-lg mx-auto px-2 pt-1 pb-1 flex justify-around">
          {([
            { tab: 'home' as Tab, icon: <HomeIcon className="w-6 h-6" />, label: '首頁' },
            { tab: 'plaza' as Tab, icon: <PlazaIcon className="w-6 h-6" />, label: '廣場' },
            { tab: 'messages' as Tab, icon: <MessageIcon className="w-6 h-6" />, label: '私訊', badge: unreadDmCount },
            { tab: 'notifications' as Tab, icon: <BellIcon className="w-6 h-6" />, label: '通知', badge: unreadCount },
            { tab: 'profile' as Tab, icon: <UserIcon className="w-6 h-6" />, label: '我的' },
          ] as { tab: Tab; icon: React.ReactNode; label: string; badge?: number }[]).map(({ tab, icon, label, badge }) => {
            const active = activeTab === tab && isOnTabs
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className="pressable relative flex flex-col items-center gap-0.5 px-4 py-2 min-w-[56px]"
              >
                {/* 指示條 */}
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-300 ${
                  active ? 'w-5 bg-gray-900' : 'w-0 bg-transparent'
                }`} />
                <span className={`transition-all duration-200 ${active ? 'text-gray-900 scale-110' : 'text-gray-400 scale-100'}`}>
                  {icon}
                </span>
                <span className={`text-[10px] font-medium tracking-wide transition-colors duration-200 ${active ? 'text-gray-900' : 'text-gray-400'}`}>
                  {label}
                </span>
                {badge != null && badge > 0 && (
                  <span className="absolute top-1.5 right-2 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-semibold shadow-sm">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            )
          })}
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
