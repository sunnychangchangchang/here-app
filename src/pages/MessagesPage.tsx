import ConversationListPage from './ConversationListPage'

interface MessagesPageProps {
  onStartChat: (conversationId: string, otherUserId: string, otherUsername: string) => void
  onUserClick?: (userId: string) => void
}

export default function MessagesPage({ onStartChat, onUserClick }: MessagesPageProps) {
  return <ConversationListPage onStartChat={onStartChat} onUserClick={onUserClick} />
}
