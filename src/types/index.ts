export interface Profile {
  id: string
  username: string
  bio: string | null
  language: string
  is_available: boolean
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  content: string
  waiting_for_reply: boolean
  created_at: string
  profiles?: Profile
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export interface AppState {
  profile: Profile | null
  isLoggedIn: boolean
}
