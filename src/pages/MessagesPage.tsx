import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import ConversationListPage from './ConversationListPage'

interface MessagesPageProps {
  onStartChat: (conversationId: string, otherUserId: string, otherUsername: string) => void
  onUserClick?: (userId: string) => void
}

export default function MessagesPage({ onStartChat, onUserClick }: MessagesPageProps) {
  const { profile, setProfile } = useApp()
  const isOpen = profile?.dm_permission === 'everyone'

  const toggle = async () => {
    if (!profile) return
    const next = isOpen ? 'mutual' : 'everyone'
    setProfile({ ...profile, dm_permission: next })
    await supabase.from('profiles').update({ dm_permission: next }).eq('id', profile.id)
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* DM 權限設定 */}
      <div className="px-4 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">開放所有人傳訊息給我</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isOpen ? '所有人都能傳訊息給你' : '只有互相追蹤的人才能傳訊息'}
          </p>
        </div>
        <button
          onClick={toggle}
          className={`relative w-12 h-7 rounded-full transition-colors duration-300 flex-shrink-0 ${isOpen ? 'bg-gray-900' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${isOpen ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <ConversationListPage onStartChat={onStartChat} onUserClick={onUserClick} />
    </div>
  )
}
