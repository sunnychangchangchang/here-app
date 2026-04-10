type IconProps = {
  className?: string
}

export function HomeIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9.5V20h13V9.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 20v-5.5h5V20" />
    </svg>
  )
}

export function PlazaIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
      <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
    </svg>
  )
}

export function MessageIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18l-2.5 2V7.5A2.5 2.5 0 0 1 6 5h12A2.5 2.5 0 0 1 20.5 7.5v7A2.5 2.5 0 0 1 18 17H8.5L6 18z" />
      <path strokeLinecap="round" d="M8 10h8M8 13h5" />
    </svg>
  )
}

export function BellIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 16.5h11l-1.4-1.7V10a4.6 4.6 0 1 0-9.2 0v4.8L6.5 16.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 18.5a2.3 2.3 0 0 0 4 0" />
    </svg>
  )
}

export function UserIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  )
}

export function PostIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="4.5" width="14" height="15" rx="2.5" />
      <path strokeLinecap="round" d="M8.5 9h7M8.5 12h7M8.5 15h4.5" />
    </svg>
  )
}

export function TagIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 4.5H6.5A2.5 2.5 0 0 0 4 7v4.5L12.5 20l7.5-7.5L11 4.5z" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function StatusIcon({ className = 'w-3.5 h-3.5', active = false }: IconProps & { active?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
      {active && <circle cx="8" cy="8" r="2.2" fill="white" opacity="0.35" />}
    </svg>
  )
}

export function HeartIcon({ className = 'w-4 h-4', filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20s-6.7-4.35-8.8-8.06C1.7 9.2 2.78 5.9 6.3 5.2c2.08-.42 3.66.52 4.7 1.96 1.04-1.44 2.62-2.38 4.7-1.96 3.52.7 4.6 4 3.1 6.74C18.7 15.65 12 20 12 20z" />
    </svg>
  )
}

export function CommentIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17.5l-3 2V7.5A2.5 2.5 0 0 1 6.5 5H17.5A2.5 2.5 0 0 1 20 7.5v7a2.5 2.5 0 0 1-2.5 2.5H7z" />
      <path strokeLinecap="round" d="M8 10h8M8 13h5" />
    </svg>
  )
}
