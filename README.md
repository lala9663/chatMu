# chatMu

업무시간에 친구들끼리 지금 듣는 노래를 실시간으로 공유하고, 그걸 소재로 소소하게 떠드는 소셜 음악 서비스.

## 구조

```
apps/
  mobile/     RN 앱 (Expo Dev Client) — 메인 클라이언트
  worker/     Spotify 폴링 워커 (Node + TS)
packages/
  shared/     공유 도메인 타입 (앱/워커/웹 공용)
supabase/
  migrations/ DB 스키마 (Postgres + RLS)
docs/         옵시디언 보관함 — 업무 정의서 / API 명세서 / 개발 현황
```

## 문서

`docs/` 폴더를 옵시디언 보관함으로 열면 됩니다. 시작점은 `docs/Home.md`.

- **업무 정의서** — 기능별 요구사항과 정책
- **API 명세서** — DB 스키마, Edge Functions, 외부 API 연동
- **개발 현황** — 단계별 로드맵과 결정 로그

제품/기술 원칙의 원본은 [CLAUDE.md](./CLAUDE.md).

## 시작하기

```bash
npm install

# 워커 개발
cp apps/worker/.env.example apps/worker/.env  # 값 채우기
npm run worker:dev

# 앱 개발 (Expo Dev Client 필요 — 네이티브 모듈 사용)
npm run mobile:start
```

## 개발 순서 (각 단계는 배포 가능한 상태로 종료)

1. RN 앱 뼈대 + Spotify ← **현재**
2. Android 알림 리스너 (Kotlin)
3. 잠수 모드 / 곡 숨기기
4. iOS Apple Music 감지 (Swift)
5. PC 웹 뷰어
