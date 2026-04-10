import { useState } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import ConversationListPage from './ConversationListPage'

interface MessagesPageProps {
  onStartChat: (conversationId: string, otherUserId: string, otherUsername: string) => void
  onUserClick?: (userId: string) => void
}

export default function MessagesPage({ onStartChat, onUserClick }: MessagesPageProps) {
  const { profile, setProfile } = useApp()
  const [dmPermission, setDmPermission] = useState<'everyone' | 'mutual'>(
    profile?.dm_permission || 'everyone'
  )

  const saveDmPermission = async (perm: 'everyone' | 'mutual') => {
    if (!profile) return
    setDmPermission(perm)
    await supabase.from('profiles').update({ dm_permission: perm }).eq('id', profile.id)
    setProfile({ ...profile, dm_permission: perm })
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* DM 權限設定 */}
      <div className="px-4 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">誰可以傳訊息給我</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {dmPermission === 'everyone' ? '所有人都能傳訊息給你' : '只有互相追蹤的人能傳訊息'}
            </p>
          </div>
          {/* iOS 風格開關 */}
          <button
            onClick={() => saveDmPermission(dmPermission === 'everyone' ? 'mutual' : 'everyone')}
            className={`relative w-12 h-7 rounded-full transition-colors duration-300 flex-shrink-0 ${
              dmPermission === 'mutual' ? 'bg-gray-900' : 'bg-gray-300'
            }`}
          >
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
              dmPermission === 'mutual' ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {dmPermission === 'everyone' ? '已開放所有人' : '限互相追蹤'}
        </p>
      </div>

      {/* 對話列表 */}
      <ConversationListPage onStartChat={onStartChat} onUserClick={onUserClick} />
    </div>
  )
}
