package com.chatmu.mediadetector

/**
 * 음악앱 패키지 → chatMu 플랫폼 문자열 매핑.
 * Spotify는 서버 워커가 처리하므로 여기에 없음(감지 대상 아님).
 * 매핑에 없는 패키지는 무시된다. 새 앱 추가는 여기 한 줄이면 끝.
 */
object PackagePlatformMap {
  private val MAP = mapOf(
    "com.google.android.apps.youtube.music" to "youtube_music",
    "com.iloen.melon" to "melon",
    "com.ktmusic.geniemusic" to "genie",
  )

  fun platformFor(packageName: String?): String? = packageName?.let { MAP[it] }
}
