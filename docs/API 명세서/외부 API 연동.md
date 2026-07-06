---
tags: [API명세서, 외부API]
updated: 2026-07-06
---

# 외부 API 연동

## Spotify Web API

| 항목 | 내용 |
|---|---|
| 용도 | 유저의 "지금 듣는 중" 자동 감지 |
| 엔드포인트 | `GET /v1/me/player/currently-playing` |
| 인증 | OAuth 2.0 Authorization Code. 토큰 교환은 Edge Function, refresh는 워커 |
| 폴링 주기 | 30초~1분 (워커) |
| 스코프 | `user-read-currently-playing`, `user-read-playback-state` |

워커 동작:
1. 연동 유저 목록 조회 → **`is_sharing=false` 또는 `sharing_paused_until` 미래인 유저는 폴링 자체를 스킵** (잠수 모드 크리티컬 규칙)
2. access token 만료 시 refresh
3. currently-playing 조회 → 곡이 바뀌었으면 `tracks` 확보(Odesli) → `now_playing` upsert + `plays` append
4. 429/5xx는 지수 백오프

> [!warning] Spotify API 정책 변경 리스크는 구조적으로 감수하기로 확정.

## Odesli (song.link) API

| 항목 | 내용 |
|---|---|
| 용도 | 플랫폼별 곡 ID 매칭 → 전 플랫폼 링크 변환 |
| 엔드포인트 | `GET https://api.song.link/v1-alpha.1/links?url=...` |
| 인증 | 무료 티어 (rate limit 낮음) |

**캐싱 필수 규칙:**
- `tracks.odesli_id` 기준 캐시 히트 우선, 미스일 때만 호출
- 실패 시 원본 플랫폼 링크만이라도 표시 (graceful degradation)

## 카카오

| 항목 | 내용 |
|---|---|
| 용도 | 로그인 (Supabase Auth 카카오 OAuth), 초대 링크 메시지 공유 |
| SDK | @react-native-kakao (앱) |
| 주의 | 카카오 키는 클라이언트 번들에 넣지 않는다. 토큰 교환은 Edge Function |

## 미지원 확정

- 멜론/유튜브뮤직 공식 API 없음 → Android 알림 리스너가 유일한 합법적 감지 경로. **웹 스크래핑/비공식 API 사용 금지.**

## 관련 문서

- [[Edge Functions 명세]]
- [[기능 - 실시간 재생 피드]]
