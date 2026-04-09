import { useState } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'

const LANGUAGES = [
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
]

export default function ProfilePage() {
  const { profile, setProfile, signOut } = useApp()
  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [language, setLanguage] = useState(profile?.language || 'zh-TW')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const saveProfile = async () => {
    if (!profile) return
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('profiles')
      .update({ username, bio, language })
      .eq('id', profile.id)
      .select()
      .single()

    if (!error && data) {
      setProfile(data)
      setMessage('儲存成功')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* 頭像區 */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-3xl font-medium text-gray-600 mb-3">
          {profile?.username?.[0]?.toUpperCase()}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{profile?.username}</h2>
        <span className={`mt-1 text-xs px-3 py-1 rounded-full ${
          profile?.is_available
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {profile?.is_available ? '🟢 現在有空' : '⚪ 目前在忙'}
        </span>
      </div>

      {/* 編輯表單 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">用戶名稱</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">自我介紹</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="簡單介紹一下自己..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">主要語言</label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.label}
              </option>
            ))}
          </select>
        </div>

        {message && (
          <p className="text-green-600 text-sm bg-green-50 rounded-xl px-4 py-3">{message}</p>
        )}

        <button
          onClick={saveProfile}
          disabled={loading}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {loading ? '儲存中...' : '儲存'}
        </button>
      </div>

      {/* 登出 */}
      <button
        onClick={signOut}
        className="w-full mt-4 py-3 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
      >
        登出
      </button>
    </div>
  )
}