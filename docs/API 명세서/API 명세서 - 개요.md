---
tags: [API명세서]
updated: 2026-07-06
---

# API 명세서 - 개요

## 아키텍처 원칙

- **별도 API 서버를 만들지 않는다.** 클라이언트는 Supabase에 직접 접근하고, RLS가 보안 경계다.
- 서버 로직이 필요하면 **Edge Function**으로 만든다.
- Spotify 폴링 워커는 "Spotify 상태를 DB에 쓰기"만 담당한다. API 로직을 워커에 넣지 않는다.
- 시크릿(카카오 키, Spotify secret)은 절대 클라이언트 번들에 넣지 않는다. 토큰 교환은 Edge Function 또는 워커에서.

## 시스템 구성도

```
[RN 앱] ──직접 접근(RLS)──▶ [Supabase Postgres]
   ▲                            ▲       │
   │ Realtime 구독              │ write │ Realtime
   └────────────────────────────┼───────┘
                                │
[폴링 워커 (Node/TS, Railway)] ─┘
   │
   └─▶ Spotify Web API (currently-playing, 30초~1분 주기)

[Edge Functions] ◀─ 앱 호출 (푸시 발송, Odesli 변환, OAuth 토큰 교환)
```

## 문서 구성

- [[DB 스키마]] — 테이블 정의, RLS 정책
- [[외부 API 연동]] — Spotify / Odesli / 카카오
- [[Edge Functions 명세]] — 서버 로직 엔드포인트

## 타입 공유

곡/재생상태 등 도메인 타입은 `packages/shared`에 정의하고 앱/워커/웹이 공유한다. TypeScript strict, `any` 금지.
