package com.bumojasik.app.haptic

import android.os.Build
import android.view.HapticFeedbackConstants
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

// P7 도장 '쾅'이 닿는 순간의 시스템 촉각 1회(시안 P7_motion "HapticFeedback CONFIRM 계열, 길게 울리지 않음").
// View.performHapticFeedback 은 시스템 '터치 진동' 설정을 따르고 VIBRATE 권한이 필요 없다(Vibration API 와 다름).
// API 30+ 는 CONFIRM, 그 아래는 VIRTUAL_KEY(짧은 시스템 진동). 화면이 없으면 아무것도 하지 않는다.
class HapticModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = NAME

  @ReactMethod
  fun confirm() {
    UiThreadUtil.runOnUiThread {
      val view = context.currentActivity?.window?.decorView ?: return@runOnUiThread
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
      view.performHapticFeedback(type)
    }
  }

  companion object {
    const val NAME = "HapticModule"
  }
}
