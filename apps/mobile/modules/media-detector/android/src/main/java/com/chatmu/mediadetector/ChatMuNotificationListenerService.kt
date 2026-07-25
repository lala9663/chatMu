package com.chatmu.mediadetector

import android.content.ComponentName
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.service.notification.NotificationListenerService
import android.util.Log

/**
 * 알림 접근 권한을 받는 서비스. 권한이 허용되면 시스템이 자동 바인딩하여
 * onListenerConnected가 호출된다. 여기서 MediaSessionManager로 활성 미디어 세션을
 * 구독해 "지금 듣는 곡" 메타데이터를 읽는다. (알림 텍스트 파싱보다 구조화된 정보)
 */
class ChatMuNotificationListenerService : NotificationListenerService() {

  private var sessionManager: MediaSessionManager? = null
  private val activeCallbacks = mutableListOf<Pair<MediaController, MediaController.Callback>>()

  private val sessionsChangedListener =
    MediaSessionManager.OnActiveSessionsChangedListener { controllers ->
      syncControllers(controllers ?: emptyList())
    }

  override fun onListenerConnected() {
    super.onListenerConnected()
    val component = ComponentName(this, ChatMuNotificationListenerService::class.java)
    val manager = getSystemService(MEDIA_SESSION_SERVICE) as MediaSessionManager
    sessionManager = manager
    try {
      manager.addOnActiveSessionsChangedListener(sessionsChangedListener, component)
      syncControllers(manager.getActiveSessions(component))
    } catch (e: SecurityException) {
      // 아직 권한이 없으면 여기 안 옴이 정상이지만 방어적으로 무시
      Log.w(TAG, "getActiveSessions denied", e)
    }
  }

  override fun onListenerDisconnected() {
    sessionManager?.removeOnActiveSessionsChangedListener(sessionsChangedListener)
    clearCallbacks()
    super.onListenerDisconnected()
  }

  /** 활성 세션이 바뀔 때마다 콜백을 새로 등록(빈도 낮음). 중복 emit은 브릿지가 걸러냄. */
  private fun syncControllers(controllers: List<MediaController>) {
    clearCallbacks()
    val supported = controllers.filter { PackagePlatformMap.platformFor(it.packageName) != null }
    for (controller in supported) {
      val callback = object : MediaController.Callback() {
        override fun onMetadataChanged(metadata: MediaMetadata?) = emit(controller)
        override fun onPlaybackStateChanged(state: PlaybackState?) = emit(controller)
      }
      controller.registerCallback(callback)
      activeCallbacks.add(controller to callback)
      emit(controller)
    }
  }

  private fun emit(controller: MediaController) {
    val platform = PackagePlatformMap.platformFor(controller.packageName) ?: return
    val metadata = controller.metadata ?: return

    val title = metadata.getString(MediaMetadata.METADATA_KEY_TITLE)?.trim().orEmpty()
    val artist = (metadata.getString(MediaMetadata.METADATA_KEY_ARTIST)
      ?: metadata.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST))?.trim().orEmpty()
    if (title.isEmpty() || artist.isEmpty()) return // 광고/미상 트랙 무시

    val album = metadata.getString(MediaMetadata.METADATA_KEY_ALBUM)?.trim()
    val artworkUrl = metadata.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI)
      ?: metadata.getString(MediaMetadata.METADATA_KEY_ART_URI)
      ?: metadata.getString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI)
    val isPlaying = controller.playbackState?.state == PlaybackState.STATE_PLAYING

    MediaDetectorBridge.emitTrack(
      packageName = controller.packageName,
      platform = platform,
      title = title,
      artist = artist,
      album = album,
      artworkUrl = artworkUrl,
      isPlaying = isPlaying,
    )
  }

  private fun clearCallbacks() {
    activeCallbacks.forEach { (controller, callback) -> controller.unregisterCallback(callback) }
    activeCallbacks.clear()
  }

  companion object {
    private const val TAG = "ChatMuDetector"
  }
}
