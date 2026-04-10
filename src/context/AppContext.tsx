import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../supabase'
import type { Profile } from '../types'

interface AppContextType {
  profile: Profile | null
  setProfile: (profile: Profile | null) => void
  isLoggedIn: boolean
  isLoading: boolean
  signOut: () => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 檢查目前登入狀態
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setIsLoading(false)
      }
    })

    // 監聽登入狀態變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    setProfile(data)
    setIsLoading(false)
  }

  const signOut = async () => {
    if (profile) {
      await supabase.from('profiles').update({ is_available: false }).eq('id', profile.id)
    }
    await supabase.auth.signOut()
  }

  return (
    <AppContext.Provider value={{
      profile,
      setProfile,
      isLoggedIn: !!profile,
      isLoading,
      signOut
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
