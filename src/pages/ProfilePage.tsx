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
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [language, setLanguage] = useState(profile?.language || 'zh-TW')
  const [saving, setSaving] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

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

  const startEdit = () => {
    setUsername(profile?.username || '')
    setBio(profile?.bio || '')
    setLanguage(profile?.language || 'zh-TW')
    setEditing(true)
  }

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    const { data, error } = await supabase
      .from('profiles').update({ username, bio, language })
      .eq('id', profile.id).select().single()
    if (!error && data) { setProfile(data) }
    setSaving(false)
    setEditing(false)
  }

  const submitFeedback = async () => {
    if (!profile || !feedback.trim()) return
    await supabase.from('feedback').insert({ user_id: profile.id, content: feedback.trim() })
    setFeedback('')
    setFeedbackSent(true)
    setShowFeedback(false)
    setTimeout(() => setFeedbackSent(false), 3000)
  }

  const langLabel = LANGUAGES.find(l => l.code === (profile?.language || language))

  return (
    <div className="max-w-lg mx-auto px-4 py-6">

      {/* 頭像 + 基本資料 */}
      <div className="flex flex-col items-center mb-6 relative">
        {/* 編輯 / 儲存 按鈕 */}
        {!editing ? (
          <button
            onClick={startEdit}
            className="absolute right-0 top-0 text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1"
          >
            編輯
          </button>
        ) : (
          <div className="absolute right-0 top-0 flex gap-3">
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">取消</button>
            <button onClick={saveProfile} disabled={saving} className="text-xs text-gray-900 font-medium px-2 py-1 disabled:opacity-50">
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        )}

        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-3xl font-semibold text-gray-600 mb-3">
          {profile?.username?.[0]?.toUpperCase()}
        </div>

        {/* 名稱 */}
        {editing ? (
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="text-lg font-bold text-gray-900 text-center border-b border-gray-300 focus:outline-none focus:border-gray-600 pb-0.5 mb-2 bg-transparent w-40"
          />
        ) : (
          <h2 className="text-lg font-bold text-gray-900 mb-1">{profile?.username}</h2>
        )}

        {/* 狀態 */}
        <span className={`text-xs px-3 py-1 rounded-full font-medium inline-flex items-center gap-1.5 mb-4 ${
          profile?.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          <StatusIcon active={!!profile?.is_available} className="w-3 h-3" />
          {profile?.is_available ? '現在有空' : '目前在忙'}
        </span>

        {/* 追蹤數 */}
        <div className="flex gap-8">
          <div className="text-center">
            <p className="text-base font-bold text-gray-900">{followerCount}</p>
            <p className="text-xs text-gray-400">追蹤者</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-900">{followingCount}</p>
            <p className="text-xs text-gray-400">追蹤中</p>
          </div>
        </div>
      </div>

      {/* 資料區塊 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 mb-4">
        {/* 自我介紹 */}
        <div className="px-5 py-4">
          <p className="text-xs text-gray-400 mb-1">自我介紹</p>
          {editing ? (
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="簡單介紹一下自己..."
              rows={3}
              className="w-full text-sm text-gray-700 focus:outline-none resize-none bg-transparent leading-relaxed"
            />
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">
              {profile?.bio || <span className="text-gray-300">尚未填寫</span>}
            </p>
          )}
        </div>

        {/* 主要語言 */}
        <div className="px-5 py-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">主要語言</p>
          {editing ? (
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="text-sm text-gray-700 focus:outline-none bg-transparent text-right"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-700">{langLabel?.flag} {langLabel?.label}</p>
          )}
        </div>
      </div>

      {/* 回饋 */}
      <div className="mb-6">
        {feedbackSent ? (
          <p className="text-xs text-green-600 text-center py-2">感謝你的回饋！</p>
        ) : showFeedback ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="遇到 bug、有新想法、任何建議都歡迎..."
              rows={3}
              autoFocus
              className="w-full text-sm text-gray-700 focus:outline-none resize-none leading-relaxed"
            />
            <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-gray-50">
              <button onClick={() => setShowFeedback(false)} className="text-xs text-gray-400">取消</button>
              <button
                onClick={submitFeedback}
                disabled={!feedback.trim()}
                className="text-xs text-gray-900 font-medium disabled:opacity-40"
              >
                送出
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowFeedback(true)}
            className="w-full text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors text-center"
          >
            回饋給開發者
          </button>
        )}
      </div>

      {/* 登出 */}
      <button
        onClick={signOut}
        className="w-full text-sm text-red-400 hover:text-red-500 py-2 transition-colors text-center"
      >
        登出
      </button>
    </div>
  )
}
