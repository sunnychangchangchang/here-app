import { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import PlazaPage from './pages/PlazaPage'
import ProfilePage from './pages/ProfilePage'

type Tab = 'home' | 'plaza' | 'profile'

function AppContent() {
  const { isLoggedIn, isLoading } = useApp()
  const [activeTab, setActiveTab] = useState<Tab>('home')

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
            {activeTab === 'profile' && '我的'}
          </h1>
        </div>
      </div>

      {/* 頁面內容 */}
      <div className="pb-20">
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'plaza' && <PlazaPage />}
        {activeTab === 'profile' && <ProfilePage />}
      </div>

      {/* 底部導航 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-2 flex justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all ${
              activeTab === 'home' ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            <span className="text-xl">🏠</span>
            <span className="text-xs font-medium">首頁</span>
          </button>
          <button
            onClick={() => setActiveTab('plaza')}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all ${
              activeTab === 'plaza' ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            <span className="text-xl">🟢</span>
            <span className="text-xs font-medium">廣場</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all ${
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