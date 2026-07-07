---
tags: [API명세서, EdgeFunctions]
updated: 2026-07-06
---

# Edge Functions 명세

> 원칙: 별도 API 서버 없음. 클라이언트가 직접 못 하는 것(시크릿 필요, 서비스 롤 필요)만 Edge Function으로.
> 위치: `supabase/functions/<이름>/`

## 목록

| 함수 | 상태 | 용도 |
|---|---|---|
| `spotify-connect` | 배포됨 (Spotify 시크릿 미설정) | Spotify OAuth 콜백 — code를 token으로 교환, refresh token 저장 |
| `join-room` | 배포됨 | 방 코드 검증 후 room_members insert |
| `resolve-track` | 배포됨 | Odesli 조회 + tracks/track_links 캐싱 (rate limit 게이트) |
| `send-recommendation-push` | 배포됨 | 추천 수신자에게 Expo Push 발송 (`x-function-secret` 헤더 인증) |

배포 프로젝트: `omphuvughzdtjtonshms` (Seoul) — `https://omphuvughzdtjtonshms.supabase.co/functions/v1/<함수명>`

---

## spotify-connect

- **Method:** POST
- **Auth:** Supabase JWT (로그인 유저)
- **Request:** `{ "code": string, "redirect_uri": string }`
- **동작:** Spotify token 엔드포인트에 code 교환 (client secret은 함수 환경변수) → `users.spotify_refresh_token` 저장 (서비스 롤)
- **Response:** `{ "ok": true }`
- **에러:** 400 (code 무효), 401 (미로그인)

## join-room

- **Method:** POST
- **Auth:** Supabase JWT
- **Request:** `{ "code": string }`
- **동작:** 방 코드 조회 → 존재하면 room_members insert (idempotent)
- **Response:** `{ "room_id": string, "name": string }`
- **에러:** 404 (코드 없음), 409는 없음 — 이미 멤버면 그냥 성공

## resolve-track

- **Method:** POST
- **Auth:** Supabase JWT 또는 워커 서비스 키
- **Request:** `{ "platform": string, "external_id": string, "url": string, "title": string, "artist": string }`
- **동작:** `track_links`에서 캐시 조회 → 히트면 즉시 반환. 미스면 Odesli 호출 → `tracks` + `track_links` upsert
- **Response:** `{ "track_id": string, "links": { [platform]: url } }`
- **실패 처리:** Odesli 실패 시에도 원본 링크만으로 track 생성 (graceful degradation)

## send-recommendation-push

- **Method:** POST (또는 DB webhook 트리거)
- **Auth:** 서비스 롤
- **Request:** `{ "recommendation_id": string }`
- **동작:** 수신자 `expo_push_token` 조회 → Expo Push API 발송. **직접 추천이 유일한 알림 예외** — 다른 이벤트에 재사용하지 말 것
- **Response:** `{ "ok": true }`

## 관련 문서

- [[DB 스키마]]
- [[외부 API 연동]]
