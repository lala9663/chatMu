-- chatMu 초기 스키마
-- 원칙: 방 멤버만 read (RLS가 보안 경계), now_playing은 유저당 1행, plays는 append only.
-- 사람용 설명서: docs/API 명세서/DB 스키마.md

-- ── users ────────────────────────────────────────────────────────────
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  avatar_url text,
  preferred_platform text not null default 'spotify'
    check (preferred_platform in ('spotify', 'melon', 'youtube_music', 'apple_music', 'genie')),
  is_sharing boolean not null default true,
  sharing_paused_until timestamptz,
  expo_push_token text,
  spotify_refresh_token text, -- 서비스 롤 전용. 클라이언트 select에 노출 금지
  created_at timestamptz not null default now()
);

-- ── rooms ────────────────────────────────────────────────────────────
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- ── tracks: 플랫폼 무관 정규화 엔티티 + Odesli 캐시 ─────────────────
create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  album text,
  artwork_url text,
  odesli_id text unique,
  odesli_fetched_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.track_links (
  track_id uuid not null references public.tracks (id) on delete cascade,
  platform text not null
    check (platform in ('spotify', 'melon', 'youtube_music', 'apple_music', 'genie')),
  external_id text not null,
  url text not null,
  primary key (track_id, platform)
);

create index track_links_platform_external_idx on public.track_links (platform, external_id);

-- ── 재생 상태 ────────────────────────────────────────────────────────
create table public.now_playing (
  user_id uuid primary key references public.users (id) on delete cascade,
  track_id uuid not null references public.tracks (id),
  source text not null check (source in ('spotify_worker', 'android_listener', 'ios_apple_music')),
  is_playing boolean not null default true,
  detected_at timestamptz not null default now()
);

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  track_id uuid not null references public.tracks (id),
  source text not null check (source in ('spotify_worker', 'android_listener', 'ios_apple_music')),
  played_at timestamptz not null default now(),
  is_hidden boolean not null default false
);

create index plays_user_played_idx on public.plays (user_id, played_at desc);

-- ── 상호작용 ─────────────────────────────────────────────────────────
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (play_id, user_id, emoji)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks (id),
  from_user_id uuid not null references public.users (id) on delete cascade,
  to_user_id uuid not null references public.users (id) on delete cascade,
  comment text,
  read_at timestamptz,
  listened_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── 잠수 모드 이중 방어: 공유 OFF 유저의 재생 write를 DB 레벨에서 차단 ──
create or replace function public.assert_user_is_sharing()
returns trigger
language plpgsql
security definer
as $$
begin
  if exists (
    select 1 from public.users u
    where u.id = new.user_id
      and (u.is_sharing = false
           or (u.sharing_paused_until is not null and u.sharing_paused_until > now()))
  ) then
    raise exception 'user % is not sharing (잠수 모드)', new.user_id;
  end if;
  return new;
end;
$$;

create trigger now_playing_sharing_guard
  before insert or update on public.now_playing
  for each row execute function public.assert_user_is_sharing();

create trigger plays_sharing_guard
  before insert on public.plays
  for each row execute function public.assert_user_is_sharing();

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.tracks enable row level security;
alter table public.track_links enable row level security;
alter table public.now_playing enable row level security;
alter table public.plays enable row level security;
alter table public.reactions enable row level security;
alter table public.messages enable row level security;
alter table public.recommendations enable row level security;

-- 같은 방 멤버인지 판정
create or replace function public.shares_room_with(target_user uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.room_members mine
    join public.room_members theirs on mine.room_id = theirs.room_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user
  );
$$;

create or replace function public.is_room_member(target_room uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = target_room and user_id = auth.uid()
  );
$$;

-- users: 같은 방 멤버 + 본인 read, 본인만 update
create policy users_read on public.users
  for select using (id = auth.uid() or public.shares_room_with(id));
create policy users_insert_self on public.users
  for insert with check (id = auth.uid());
create policy users_update_self on public.users
  for update using (id = auth.uid());

-- rooms: 멤버만 read, 로그인 유저 생성 가능
create policy rooms_read on public.rooms
  for select using (public.is_room_member(id));
create policy rooms_insert on public.rooms
  for insert with check (created_by = auth.uid());

-- room_members: 같은 방 멤버 read, 본인 입장/퇴장 (코드 검증은 join-room Edge Function)
create policy room_members_read on public.room_members
  for select using (public.is_room_member(room_id));
create policy room_members_leave on public.room_members
  for delete using (user_id = auth.uid());

-- tracks / track_links: 로그인 유저 read (곡 메타데이터는 민감정보 아님)
create policy tracks_read on public.tracks
  for select using (auth.role() = 'authenticated');
create policy track_links_read on public.track_links
  for select using (auth.role() = 'authenticated');

-- now_playing: 같은 방 멤버 + 대상이 공유 중일 때만 read
create policy now_playing_read on public.now_playing
  for select using (
    (user_id = auth.uid() or public.shares_room_with(user_id))
    and exists (
      select 1 from public.users u
      where u.id = user_id
        and u.is_sharing = true
        and (u.sharing_paused_until is null or u.sharing_paused_until <= now())
    )
  );
create policy now_playing_write_self on public.now_playing
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- plays: 같은 방 멤버 + 숨김 아님. 숨김 처리는 본인만
create policy plays_read on public.plays
  for select using (
    user_id = auth.uid()
    or (public.shares_room_with(user_id) and is_hidden = false)
  );
create policy plays_insert_self on public.plays
  for insert with check (user_id = auth.uid());
create policy plays_hide_self on public.plays
  for update using (user_id = auth.uid());

-- reactions / messages: 방 멤버 read, 본인 write
create policy reactions_read on public.reactions
  for select using (
    exists (select 1 from public.plays p
            where p.id = play_id
              and (p.user_id = auth.uid() or public.shares_room_with(p.user_id)))
  );
create policy reactions_write_self on public.reactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy messages_read on public.messages
  for select using (public.is_room_member(room_id));
create policy messages_insert_self on public.messages
  for insert with check (user_id = auth.uid() and public.is_room_member(room_id));

-- recommendations: 보낸/받은 사람만
create policy recommendations_read on public.recommendations
  for select using (from_user_id = auth.uid() or to_user_id = auth.uid());
create policy recommendations_insert on public.recommendations
  for insert with check (from_user_id = auth.uid());
create policy recommendations_update_recipient on public.recommendations
  for update using (to_user_id = auth.uid());

-- Realtime 발행
alter publication supabase_realtime add table public.now_playing;
alter publication supabase_realtime add table public.plays;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.recommendations;
