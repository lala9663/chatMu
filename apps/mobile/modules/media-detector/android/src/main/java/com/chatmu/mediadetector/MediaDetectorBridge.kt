package com.chatmu.mediadetector

/**
 * NotificationListenerService(시스템이 관리하는 별도 수명주기)와
 * MediaDetectorModule(JS 이벤트 이미터 보유) 사이의 싱글턴 브릿지.
 *
 * 서비스는 감지 결과를 여기로 넘기고, 모듈이 등록돼 있으면(=JS 살아있음) JS로 전달한다.
 * JS가 죽어있으면 이벤트는 드롭 — 네이티브는 "이벤트 전달까지만" 원칙(CLAUDE.md).
 */
object MediaDetectorBridge {
  private var module: MediaDetectorModule? = null

  /** 패키지별 마지막 시그니처 — 포지션 틱 등 중복 emit 방지 */
  private val lastSignature = HashMap<String, String>()

  fun register(m: MediaDetectorModule) {
    module = m
  }

  fun unregister(m: MediaDetectorModule) {
    if (module === m) module = null
  }

  fun emitTrack(
    packageName: String,
    platform: String,
    title: String,
    artist: String,
    album: String?,
    artworkUrl: String?,
    isPlaying: Boolean,
  ) {
    val signature = "$title|$artist|$isPlaying"
    if (lastSignature[packageName] == signature) return
    lastSignature[packageName] = signature

    module?.emitTrackChanged(
      mapOf(
        "packageName" to packageName,
        "platform" to platform,
        "title" to title,
        "artist" to artist,
        "album" to album,
        "artworkUrl" to artworkUrl,
        "isPlaying" to isPlaying,
      ),
    )
  }
}
