import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import type { Profile } from '../types'

const LANGUAGES = [
  { code: 'zh-TW', label: '繁中', flag: '🇹🇼' },
  { code: 'zh-CN', label: '簡中', flag: '🇨🇳' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
]

export default function PlazaPage() {
  const { profile } = useApp()
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([])
  const [isAvailable, setIsAvailable] = useState(false)

  useEffect(() => {
    if (profile) setIsAvailable(profile.is_available)
    fetchAvailableUsers()

    const channel = supabase
      .channel('availability-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles'
      }, () => {
        fetchAvailableUsers()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchAvailableUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_available', true)
      .order('created_at', { ascending: false })

    if (data) setAvailableUsers(data)
  }

  const toggleAvailability = async () => {
    if (!profile) return
    const newStatus = !isAvailable
    setIsAvailable(newStatus)

    await supabase
      .from('profiles')
      .update({ is_available: newStatus })
      .eq('id', profile.id)
  }

  const getLanguageLabel = (code: string) => {
    const lang = LANGUAGES.find(l => l.code === code)
    return lang ? `${lang.flag} ${lang.label}` : code
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* 我的狀態 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <p className="text-sm text-gray-500 mb-3 text-center">你現在有空嗎？</p>
        <div
          onClick={toggleAvailability}
          className="flex items-center justify-between cursor-pointer"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">
              {isAvailable ? '我現在有空' : '我在忙'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isAvailable ? '其他人可以看到你' : '開啟讓別人知道你有空'}
            </p>
          </div>
          {/* iOS 風格開關 */}
          <div className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
            isAvailable ? 'bg-green-500' : 'bg-gray-200'
          }`}>
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
              isAvailable ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </div>
        </div>
      </div>

      {/* 有空的人 */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-3">
          現在有空的人 · {availableUsers.length} 人
        </h2>

        {availableUsers.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12 bg-white rounded-2xl border border-gray-100">
            目前沒有人有空<br />
            <span className="text-xs mt-1 block">成為第一個掛上有空標記的人</span>
          </div>
        )}

        <div className="space-y-3">
          {availableUsers.map(user => (
            <div
              key={user.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 ${
                user.id === profile?.id ? 'border-green-200' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-base font-medium text-gray-600">
                  {user.username[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {user.username}
                    </span>
                    {user.id === profile?.id && (
                      <span className="text-xs text-gray-400">（你）</span>
                    )}
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      有空
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {getLanguageLabel(user.language)}
                    </span>
                    {user.bio && (
                      <span className="text-xs text-gray-400 truncate">· {user.bio}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
