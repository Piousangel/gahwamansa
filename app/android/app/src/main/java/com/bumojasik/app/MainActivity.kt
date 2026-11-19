package com.bumojasik.app

import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import com.bumojasik.app.invite.InviteIntent
import android.os.Handler
import android.os.Looper
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.bumojasik.app.splash.SplashState
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "BumoJasik"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // 시스템 스플래시(SPL_A): super.onCreate 전에 설치. JS 첫 화면이 그려질 때까지(SplashModule.hide) 유지하고,
    // 무슨 일이 있어도 3초가 지나면 걷는다(안전장치). 바탕·심볼이 JS 대기 화면과 같아 바뀌는 순간이 보이지 않는다.
    val splash = installSplashScreen()
    SplashState.ready.set(false)
    splash.setKeepOnScreenCondition { !SplashState.ready.get() }
    Handler(Looper.getMainLooper()).postDelayed({ SplashState.ready.set(true) }, SplashState.SAFETY_MS)
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    // 카톡 초대 링크(/c 페이지 intent:// 버튼): 엑스트라의 번호를 URL 조각으로 옮긴다(JS Linking 이 읽음)
    InviteIntent.moveCodeExtraToFragment(intent)
    super.onCreate(savedInstanceState)
    // D-40: 앱이 앞에 있는 동안 볼륨 키는 미디어 볼륨(BGM·도장 소리·읽어 주기가 모두 미디어 스트림). 소리가 나지 않을 때도 같게
    volumeControlStream = AudioManager.STREAM_MUSIC
  }

  override fun onNewIntent(intent: Intent) {
    InviteIntent.moveCodeExtraToFragment(intent)
    super.onNewIntent(intent)
  }
}
