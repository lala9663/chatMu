package com.chatmu.mediadetector

import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS ↔ 네이티브 브릿지. 최소 표면적:
 *  - getPermissionStatus(): 알림 접근 권한 여부
 *  - openPermissionSettings(): 설정 화면 열기 (런타임 팝업이 아니라 설정 진입 필요)
 *  - onTrackChanged 이벤트: 감지된 곡을 JS로 전달
 * 업로드/비즈 로직은 JS/Edge Function 담당 (CLAUDE.md).
 */
class MediaDetectorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MediaDetector")

    Events("onTrackChanged")

    OnCreate {
      MediaDetectorBridge.register(this@MediaDetectorModule)
    }

    OnDestroy {
      MediaDetectorBridge.unregister(this@MediaDetectorModule)
    }

    Function("getPermissionStatus") {
      isNotificationAccessGranted()
    }

    Function("openPermissionSettings") {
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  fun emitTrackChanged(payload: Map<String, Any?>) {
    sendEvent("onTrackChanged", payload)
  }

  private fun isNotificationAccessGranted(): Boolean {
    val context = appContext.reactContext ?: return false
    val enabled = Settings.Secure.getString(
      context.contentResolver,
      "enabled_notification_listeners",
    ) ?: return false
    val pkg = context.packageName
    // "pkg/pkg.Service" 형태가 콜론으로 구분되어 나열됨
    return enabled.split(":").any { it.contains(pkg) }
  }
}
