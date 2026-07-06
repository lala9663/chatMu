# CLAUDE.md

이 파일은 Claude가 이 프로젝트에서 작업할 때 참고하는 프로젝트 컨텍스트 문서입니다.
모든 코드 작업 전에 이 문서의 제품 정의, 아키텍처, 컨벤션을 따르세요.

---

## 1. 프로젝트 개요

**업무시간에 친구들끼리 지금 듣는 노래를 실시간으로 공유하고, 그걸 소재로 소소하게 떠드는 소셜 음악 서비스.**

- 경쟁자는 다른 음악 앱이 아니라 "업무시간의 카톡 잡담"이다. 음악은 잡담의 소재.
- 핵심 검증 질문: **친구 그룹 하나가 업무시간에 3주 이상 자발적으로 켜두는가.**
- UX 지향: **조용한 존재감.** 앰비언트 피드, 알림 최소화(기본 OFF, 직접 추천받았을 때만), 10초 단위의 저마찰 상호작용(이모지 반응, 한 줄 채팅).
- 타깃: 한국 직장인. 멜론/유튜브뮤직/스포티파이/애플뮤직 파편화된 플랫폼을 넘나드는 공유가 핵심 가치.

## 2. 폼팩터

| 클라이언트 | 역할 | 우선순위 |
|---|---|---|
| RN 앱 (iOS/Android) | **메인.** 재생 감지(백그라운드) + 피드/반응/채팅/추천/잠수모드 전 기능 | 1순위 |
| PC 웹 (React) | **서브.** 업무 중 브라우저 뷰어 + 초대 링크 랜딩 페이지 | MVP 이후 |

## 3. 재생 감지 커버리지 (확정 스코프)

| 상황 | 감지 방법 | 자동 |
|---|---|---|
| Spotify (모든 기기) | 서버 폴링 워커 (Spotify Web API `currently-playing`) | ✅ |
| Android + 모든 음악앱 (멜론/유튜브뮤직/지니 포함) | `NotificationListenerService` / `MediaSessionManager` (Kotlin 네이티브 모듈) | ✅ |
| iPhone + Apple Music | `MPMusicPlayerController` (Swift 네이티브 모듈) | ✅ |
| iPhone + 유튜브뮤직/멜론 | **미지원.** (추후 공유 시트 확장 고려) | — |

- 곡 통합: 플랫폼마다 곡 ID가 다르므로 **Odesli(song.link) API**로 매칭/전 플랫폼 링크 변환. 결과는 반드시 DB에 캐싱 (무료 티어 rate limit).

## 4. 기술 스택

### 모바일 앱 (메인)
- React Native + **Expo Dev Client** (managed 불가 — 네이티브 모듈 필요) + EAS Build
- TypeScript strict 모드
- 상태 관리: Zustand + TanStack Query
- Android 네이티브 모듈: **Kotlin** — 알림 리스너 재생 감지
- iOS 네이티브 모듈: **Swift** — Apple Music 재생 감지
- 카카오 SDK: 로그인 + 초대 링크 공유
- 푸시: Expo Push Notifications

### 백엔드
- **Supabase**: Postgres + Auth(카카오 OAuth) + Realtime + RLS + Edge Functions
- **Spotify 폴링 워커**: Node + TypeScript, Railway/Fly.io 배포
  - 연동 유저의 access token 관리/갱신, 30초~1분 주기 폴링, 결과를 DB에 write → Realtime이 클라이언트로 자동 푸시
  - 워커는 "Spotify 상태를 DB에 쓰기"만 담당. API 로직을 여기 넣지 말 것.

### 웹 뷰어 (MVP 이후)
- React + TypeScript + Vite, Vercel 배포
- 앱과 동일한 Supabase 클라이언트/타입 공유

### 외부 API
- Spotify Web API (OAuth + currently-playing)
- Odesli API (곡 → 전 플랫폼 링크, **캐싱 필수**)
- 카카오 (로그인, 메시지 공유)

## 5. DB 스키마 방향 (초안)

핵심 테이블: `users`, `rooms`, `room_members`, `tracks`(Odesli 캐시 포함),
`now_playing`(유저별 현재 재생 상태), `plays`(재생 히스토리),
`reactions`, `messages`, `recommendations`

원칙:
- `tracks`는 플랫폼 무관 정규화 엔티티. 플랫폼별 ID/링크는 별도 컬럼 또는 `track_links` 테이블로.
- `now_playing`은 유저당 1행 upsert. 히스토리는 `plays`에 append.
- 모든 테이블에 RLS 적용: 방 멤버만 해당 방 데이터 read 가능.
- 잠수 모드: `users.is_sharing` (또는 `sharing_paused_until`) 플래그. 워커와 감지 모듈 모두 이 플래그를 존중해야 함.

## 6. MVP 기능 스코프

1. 방 생성 / 초대 (초기: 방 코드 입장, 딥링크는 뼈대만)
2. 실시간 "지금 듣는 중" 피드 — 앨범아트 + 곡 정보 + "내 플랫폼으로 열기"
3. 곡에 이모지 반응 + 한 줄 채팅
4. 친구에게 곡 추천
5. **잠수 모드** (공유 일시정지) — 부가기능 아님, 신뢰의 기본. 곡 숨기기 포함.

MVP 이후 리텐션 훅 후보: 퇴근길 "오늘의 방 최다 재생곡" 요약 푸시, 주간 리캡, 내 추천곡을 친구가 실제로 들었을 때 알림.

## 7. 개발 순서

1. **RN 앱 뼈대 + Spotify**: Supabase 스키마, 카카오 로그인, 방/피드/반응/채팅, Spotify 폴링 워커 → 이 시점에 친구들과 실사용 테스트 시작
2. **Android 알림 리스너** (Kotlin) → 멜론/유튜브뮤직/지니 자동 감지
3. **잠수 모드 / 곡 숨기기**
4. **iOS Apple Music 감지** (Swift)
5. **PC 웹 뷰어** + 초대 랜딩 페이지

각 단계는 배포 가능한 상태로 끝낼 것. 다음 단계 기능을 미리 절반만 만들어두지 말 것.

## 8. 코딩 컨벤션

- TypeScript strict. `any` 금지, 불가피하면 `unknown` + 타입 가드.
- 곡/재생상태 등 도메인 타입은 `packages/shared` (모노레포) 또는 공용 타입 파일에 정의해 앱/워커/웹이 공유.
- Supabase 접근은 클라이언트에서 직접 (RLS가 보안 경계). 별도 API 서버를 만들지 말 것 — 서버 로직이 필요하면 Edge Function.
- 네이티브 모듈은 최소 표면적: 감지 이벤트를 JS로 넘기는 것까지만. 업로드/비즈니스 로직은 JS/TS 레이어에서.
- 시크릿(카카오 키, Spotify secret 등)은 절대 클라이언트 번들에 넣지 말 것. 토큰 교환은 Edge Function 또는 워커에서.
- 커밋은 기능 단위로 작게. 각 개발 단계(7번) 완료 시점에 태그.

## 9. 알려진 제약 / 주의사항

- **Spotify API 정책 변경 리스크**: 자동 감지의 한 축이 서드파티 정책에 의존. 구조적으로 감수.
- **Android 알림 리스너 권한**: 일반 권한 팝업이 아니라 설정 화면 진입 필요 → 온보딩 안내 화면에 공들일 것.
- **iOS 백그라운드 제약**: Apple Music 감지가 완전 실시간이 아닐 수 있음 → UI에 "마지막 감지 시각" 표시로 기대치 관리.
- **Odesli rate limit**: 캐시 히트 우선, 미스일 때만 호출. 실패 시 원본 플랫폼 링크만이라도 표시하는 graceful degradation.
- **멜론/유튜브뮤직 공식 API 없음**: Android 알림 리스너가 유일한 합법적 자동 감지 경로. 웹 스크래핑/비공식 API 사용하지 말 것.
- **프라이버시가 제품의 전제**: 상시 공유 서비스이므로 잠수 모드/숨기기 관련 코드는 항상 최우선으로 동작 보장. 공유 OFF 상태에서 데이터가 새는 버그는 크리티컬로 취급.
