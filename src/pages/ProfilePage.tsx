import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../context/AppContext'
import { StatusIcon } from '../components/icons'

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
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    ]).then(([followers, following]) => {
      setFollowerCount(followers.count || 0)
      setFollowingCount(following.count || 0)
    })
  }, [profile])

  const submitFeedback = async () => {
    if (!profile || !feedback.trim()) return
    setFeedbackLoading(true)
    const { error } = await supabase.from('feedback').insert({
      user_id: profile.id,
      content: feedback.trim()
    })
    if (!error) {
      setFeedback('')
      setFeedbackMessage('感謝你的回饋！')
      setTimeout(() => setFeedbackMessage(''), 3000)
    }
    setFeedbackLoading(false)
  }

  const saveProfile = async () => {
    if (!profile) return
    setLoading(true)
    setMessage('')
    const { data, error } = await supabase
      .from('profiles').update({ username, bio, language })
      .eq('id', profile.id).select().single()
    if (!error && data) { setProfile(data); setMessage('儲存成功') }
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* 頭像區 */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-3xl font-semibold text-gray-600 mb-3">
          {profile?.username?.[0]?.toUpperCase()}
        </div>
        <h2 className="text-lg font-bold text-gray-900">{profile?.username}</h2>
        <span className={`mt-1.5 text-xs px-3 py-1 rounded-full font-medium ${
          profile?.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        } inline-flex items-center gap-1.5`}>
          <StatusIcon active={!!profile?.is_available} className="w-3.5 h-3.5" />
          {profile?.is_available ? '現在有空' : '目前在忙'}
        </span>
        <div className="flex gap-8 mt-4">
          <div className="text-center">
            <p className="text-base font-bold text-gray-900">{followerCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">追蹤者</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-900">{followingCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">追蹤中</p>
          </div>
        </div>
      </div>

      {/* 編輯表單 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">用戶名稱</label>
          <input
            type="text" value={username} onChange={e => setUsername(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">自我介紹</label>
          <textarea
            value={bio} onChange={e => setBio(e.target.value)}
            placeholder="簡單介紹一下自己..." rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">主要語言</label>
          <select
            value={language} onChange={e => setLanguage(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>
            ))}
          </select>
        </div>

        {message && (
          <p className="text-green-600 text-sm bg-green-50 rounded-xl px-4 py-3 font-medium">{message}</p>
        )}

        <button
          onClick={saveProfile} disabled={loading}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {loading ? '儲存中...' : '儲存'}
        </button>
      </div>

      {/* 回饋 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">回饋給開發者</label>
          <p className="text-xs text-gray-400 mb-2">遇到 bug、有新功能想法、或任何建議都歡迎</p>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="說說你的想法..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
          />
        </div>
        {feedbackMessage && (
          <p className="text-green-600 text-sm bg-green-50 rounded-xl px-4 py-3 font-medium">{feedbackMessage}</p>
        )}
        <button
          onClick={submitFeedback}
          disabled={feedbackLoading || !feedback.trim()}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {feedbackLoading ? '送出中...' : '送出回饋'}
        </button>
      </div>

      <button
        onClick={signOut}
        className="w-full mt-4 py-3 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
      >
        登出
      </button>
    </div>
  )
}
