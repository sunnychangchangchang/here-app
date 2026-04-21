export interface Profile {
  id: string
  username: string
  bio: string | null
  language: string
  is_available: boolean
  dm_permission: 'everyone' | 'mutual'
  invite_code: string
  invited_by: string | null
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  content: string
  waiting_for_reply: boolean
  tags: string[]
  image_urls: string[]
  created_at: string
  expires_at: string
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

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  image_url: string | null
  is_read: boolean
  created_at: string
}

export interface ConversationRequest {
  id: string
  post_id: string
  sender_id: string
  receiver_id: string
  message: string
  status: 'pending' | 'accepted' | 'ignored' | 'blocked'
  created_at: string
  profiles?: Profile
  posts?: { content: string; tags: string[] }
}

export interface Notification {
  id: string
  user_id: string
  type: string
  message: string
  post_id: string | null
  is_read: boolean
  created_at: string
}