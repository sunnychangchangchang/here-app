# Here

A private, invite-only community app for real conversations. Built around the idea that meaningful dialogue starts with a topic — not a cold DM.

---

## Purpose

Most social apps optimise for reach. Here optimises for connection.

The core loop is simple: post a topic that expires in 1, 8, or 12 hours → someone replies with a message → you accept or ignore the conversation request → a private chat opens. Every conversation starts with intent, and every topic self-destructs when its moment passes.

Access is invite-only. Each member gets an invite code to share, and the chain of who invited whom is tracked — keeping the community small and accountable.

---

## Intended Audience

- Small, trust-based communities (friend groups, study circles, hobbyist collectives)
- People who find cold DMs uncomfortable but want low-stakes ways to start talking
- Communities that prefer impermanence — posts disappear, conversations don't linger publicly

---

## Features

| Feature | Description |
|---|---|
| **Invite-only signup** | New accounts require a valid invite code from an existing member |
| **Expiring posts** | Topics last 1 / 8 / 12 hours, then vanish from the feed |
| **Conversation requests** | Reply to someone's topic → they receive a request → accept/ignore/block |
| **Private chat** | Real-time 1-on-1 messaging once a request is accepted |
| **Plaza (people radar)** | See who's currently available and what they're talking about |
| **Follow system** | Follow people; filter the home feed to "everyone" or "following" |
| **Post likes** | Like posts without opening a conversation |
| **Image uploads** | Attach up to 3 images per post |
| **Notifications** | Real-time alerts for follows, likes, and conversation requests |
| **Search** | Search posts by content, hashtag, or username |
| **Rate limiting** | Max 3 posts per 12-hour window per user |

---

## Tech Stack

### Frontend
| | |
|---|---|
| **React 19** | UI framework |
| **TypeScript** | Static typing throughout |
| **Vite 8** | Build tool and dev server |
| **Tailwind CSS v4** | Utility-first styling (via `@tailwindcss/vite` plugin) |

### Backend (Supabase)
| | |
|---|---|
| **Supabase Auth** | Email + password authentication |
| **PostgreSQL** | Primary database via Supabase |
| **Row-Level Security (RLS)** | Per-table policies enforcing data ownership |
| **Supabase Realtime** | Live subscriptions for chat messages, notifications, availability changes |
| **Supabase Storage** | Image uploads (`post-images` bucket) |
| **PostgreSQL RPC** | `get_inviter_by_code` — unauthenticated invite code validation via `SECURITY DEFINER` function |

### Deployment
- **Vercel** — frontend hosting with automatic deploys from `main`

---

## Database Schema

```
profiles       — user profile, invite_code, invited_by, is_available, language
posts          — content, tags[], image_urls[], expires_at, user_id
follows        — follower_id, following_id
post_likes     — post_id, user_id
conversation_requests — post_id, sender_id, receiver_id, message, status
conversations  — user1_id, user2_id
messages       — conversation_id, sender_id, content, image_url, is_read
notifications  — user_id, type, message, post_id, is_read
```

---

## Project Structure

```
src/
├── context/
│   └── AppContext.tsx         # Auth state, profile, global session
├── pages/
│   ├── AuthPage.tsx           # Login + invite-code signup
│   ├── HomePage.tsx           # Feed, post composer, search
│   ├── PlazaPage.tsx          # People radar (available users + active posts)
│   ├── MessagesPage.tsx       # Conversation list wrapper
│   ├── ConversationListPage.tsx
│   ├── ChatPage.tsx           # Real-time 1-on-1 chat
│   ├── NotificationPage.tsx   # Conversation requests + notifications
│   ├── ProfilePage.tsx        # Own profile, invite code, settings
│   └── UserProfilePage.tsx    # Other users' profiles + follow
├── components/
│   └── icons.tsx              # SVG icon components
├── utils/
│   └── imageUtils.ts          # Supabase Storage upload helper
├── types/
│   └── index.ts               # Shared TypeScript interfaces
├── supabase.ts                # Supabase client initialisation
└── App.tsx                    # Root layout, tab navigation, view stack
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/sunnychangchangchang/here-app.git
cd here-app
npm install
```

### 2. Configure environment

Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set up the database

Run the following SQL in the Supabase SQL editor:

<details>
<summary>Core tables</summary>

```sql
-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  bio text,
  language text default 'zh-TW',
  is_available boolean default false,
  invite_code text unique not null,
  invited_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Posts
create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  content text,
  tags text[] default '{}',
  image_urls text[] default '{}',
  waiting_for_reply boolean default false,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Follows
create table follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(follower_id, following_id)
);

-- Post likes
create table post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  unique(post_id, user_id)
);

-- Conversation requests
create table conversation_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  message text not null,
  status text default 'pending', -- pending | accepted | ignored | blocked
  created_at timestamptz default now()
);

-- Conversations
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid references profiles(id) on delete cascade,
  user2_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  content text,
  image_url text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null,
  message text not null,
  post_id uuid references posts(id) on delete set null,
  is_read boolean default false,
  created_at timestamptz default now()
);
```
</details>

<details>
<summary>Invite code RPC function</summary>

```sql
create or replace function get_inviter_by_code(code text)
returns uuid
language sql
security definer
as $$
  select id from profiles where invite_code = code limit 1;
$$;
```
</details>

### 4. Configure Storage

In Supabase dashboard → Storage → create a public bucket named `post-images`.

### 5. Run locally

```bash
npm run dev
```

App runs at `http://localhost:5173`.

### 6. Build for production

```bash
npm run build
```

---

## Conversation Flow

```
User A posts a topic (expires in 1–12h)
        ↓
User B sees it in Home feed or Plaza
        ↓
User B clicks reply and types a message
        ↓
User A receives a conversation request in Notifications
        ↓
User A accepts  →  private chat opens for both
User A ignores  →  request dismissed
User A blocks   →  all future requests from User B are blocked
```

---

## Invite System

Each profile has a unique 8-character invite code (e.g. `K7RNPX3M`). Signup requires a valid code from an existing member. The `invited_by` field on each profile tracks the invite chain, and members can see how many people they've invited from their profile page.

---

## License

MIT
