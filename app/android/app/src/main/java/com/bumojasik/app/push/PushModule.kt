package com.bumojasik.app.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Notification
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

// 알림 채널·앱 알림 상태(AU-04). 새 의존성 없음(androidx.core 는 RN 이 이미 가져옴). FCM 수신은 Firebase(US-10) 뒤 별도 항목.
// - createChannels: 채널 id 는 서버 FCM channel_id 와 같아야 한다(daily·cheer·family, api/contract/push.ts). 이름·설명은 JS 가 copy 에서 넘긴다.
//   이미 있는 채널은 이름·설명만 바뀌고 중요도·잠금 화면 공개는 사용자가 바꾼 값을 유지한다(Android 규칙).
// - 잠금 화면 공개(DECISIONS 기록 대상, dev-app-notes AU-04): daily=PUBLIC(AI 사진 설명뿐, N1 시안 잠금 화면 그림), cheer·family=PRIVATE.
class PushModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = NAME

  @ReactMethod
  fun createChannels(specs: ReadableArray, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        promise.resolve(0)
        return
      }
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      var made = 0
      for (i in 0 until specs.size()) {
        val s = specs.getMap(i) ?: continue
        val id = s.getString("id") ?: continue
        val name = s.getString("name") ?: continue
        val importance =
          if (s.hasKey("importance") && s.getString("importance") == "high") NotificationManager.IMPORTANCE_HIGH
          else NotificationManager.IMPORTANCE_DEFAULT
        val ch = NotificationChannel(id, name, importance)
        if (s.hasKey("description")) ch.description = s.getString("description")
        ch.lockscreenVisibility =
          if (s.hasKey("visibility") && s.getString("visibility") == "public") Notification.VISIBILITY_PUBLIC
          else Notification.VISIBILITY_PRIVATE
        nm.createNotificationChannel(ch)
        made++
      }
      promise.resolve(made)
    } catch (e: Exception) {
      promise.reject("push_channels", e)
    }
  }

  // 앱 단위 알림 허용(Android 12 이하에서 사용자가 앱 알림을 끈 경우까지, 13+ 는 POST_NOTIFICATIONS 와 같다)
  @ReactMethod
  fun areNotificationsEnabled(promise: Promise) {
    promise.resolve(NotificationManagerCompat.from(context).areNotificationsEnabled())
  }

  // 채널 하나가 휴대폰에서 꺼졌는지(P13 '그 채널만 꺼짐' 행). 채널이 아직 없으면 null
  @ReactMethod
  fun channelEnabled(id: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(true)
      return
    }
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val ch = nm.getNotificationChannel(id)
    promise.resolve(if (ch == null) null else ch.importance != NotificationManager.IMPORTANCE_NONE)
  }

  // 휴대폰 알림 설정 열기: 채널 id 를 주면 그 채널 화면, 아니면 앱 알림 화면(시안 P13 '그 채널 설정으로 바로')
  @ReactMethod
  fun openSettings(channelId: String?, promise: Promise) {
    try {
      val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && channelId != null) {
          Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            .putExtra(Settings.EXTRA_CHANNEL_ID, channelId)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        } else {
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(android.net.Uri.fromParts("package", context.packageName, null))
        }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  companion object {
    const val NAME = "PushModule"
  }
}
