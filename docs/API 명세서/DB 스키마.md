---
tags: [API명세서, DB]
updated: 2026-07-06
---

# DB 스키마

> 마이그레이션 원본: `supabase/migrations/0001_initial_schema.sql`
> 이 문서는 사람이 읽는 설명서. SQL과 어긋나면 SQL이 정본.

## 설계 원칙

- `tracks`는 플랫폼 무관 정규화 엔티티. 플랫폼별 ID/링크는 `track_links`로 분리.
- `now_playing`은 유저당 1행 upsert. 히스토리는 `plays`에 append.
- 모든 테이블 RLS 적용: **방 멤버만 해당 방 데이터 read 가능.**
- 잠수 모드 플래그는 워커/네이티브 모듈 모두 write 전에 체크 (write 차단이 원칙, RLS는 이중 방어).

## 테이블

### users
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | `auth.users` 참조 |
| nickname | text | 표시 이름 |
| avatar_url | text? | 프로필 이미지 |
| preferred_platform | text | melon / spotify / youtube_music / apple_music — "내 플랫폼으로 열기"에 사용 |
| is_sharing | boolean (default true) | 잠수 모드 (false = 잠수 중) |
| sharing_paused_until | timestamptz? | 시간 지정 잠수. 이 시각까지 공유 중단 |
| expo_push_token | text? | 추천 알림용 |
| spotify_refresh_token | text? | 워커 전용. 클라이언트에 노출 금지 |

### rooms
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| name | text | 방 이름 |
| code | text UNIQUE | 6자리 입장 코드 |
| created_by | uuid → users | |
| created_at | timestamptz | |

### room_members
| 컬럼 | 타입 | 설명 |
|---|---|---|
| room_id | uuid → rooms | 복합 PK |
| user_id | uuid → users | 복합 PK |
| joined_at | timestamptz | |

### tracks — 플랫폼 무관 곡 엔티티 (Odesli 캐시)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| title | text | |
| artist | text | |
| album | text? | |
| artwork_url | text? | |
| odesli_id | text? UNIQUE | Odesli entityUniqueId |
| odesli_fetched_at | timestamptz? | 캐시 시각 |

### track_links — 플랫폼별 링크
| 컬럼 | 타입 | 설명 |
|---|---|---|
| track_id | uuid → tracks | 복합 PK |
| platform | text | 복합 PK. spotify / melon / youtube_music / apple_music 등 |
| external_id | text | 플랫폼 곡 ID |
| url | text | 딥링크/웹 URL |

### now_playing — 유저당 1행 upsert
| 컬럼 | 타입 | 설명 |
|---|---|---|
| user_id | uuid PK → users | |
| track_id | uuid → tracks | |
| source | text | spotify_worker / android_listener / ios_apple_music |
| is_playing | boolean | |
| detected_at | timestamptz | "마지막 감지 시각" UI 표시용 |

### plays — 재생 히스토리 (append only)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid → users | |
| track_id | uuid → tracks | |
| source | text | |
| played_at | timestamptz | |
| is_hidden | boolean (default false) | 곡 숨기기 |

### reactions — 재생 이벤트에 귀속
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| play_id | uuid → plays | |
| user_id | uuid → users | |
| emoji | text | |
| created_at | timestamptz | |
| | | UNIQUE(play_id, user_id, emoji) — 토글 |

### messages — 곡에 대한 한 줄 채팅 (flat)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| play_id | uuid → plays | |
| room_id | uuid → rooms | |
| user_id | uuid → users | |
| body | text | |
| created_at | timestamptz | |

### recommendations
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| track_id | uuid → tracks | |
| from_user_id | uuid → users | |
| to_user_id | uuid → users | |
| comment | text? | |
| read_at | timestamptz? | |
| listened_at | timestamptz? | MVP 이후 리텐션 훅용 |
| created_at | timestamptz | |

## RLS 정책 요약

| 테이블 | read | write |
|---|---|---|
| users | 같은 방 멤버 | 본인만 (refresh token 컬럼은 서비스 롤 전용) |
| rooms / room_members | 멤버만 | 생성자/본인 입장 |
| now_playing / plays | 같은 방 멤버 + `is_hidden=false` + 대상 유저가 공유 중일 때만 | 서비스 롤(워커) 또는 본인 |
| reactions / messages | 같은 방 멤버 | 본인 |
| recommendations | 보낸/받은 사람 | 보낸 사람 |

## 관련 문서

- [[기능 - 잠수 모드]] — is_sharing / is_hidden 크리티컬 규칙
- [[Edge Functions 명세]]
