package com.bumojasik.app.splash

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// JS 첫 화면이 그려진 뒤 hide() 를 부른다 → MainActivity 의 setKeepOnScreenCondition 이 풀려 스플래시가 걷힌다.
class SplashModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = NAME

  @ReactMethod
  fun hide() {
    SplashState.ready.set(true)
  }

  companion object {
    const val NAME = "SplashModule"
  }
}
