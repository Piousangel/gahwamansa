package com.bumojasik.app.splash

import java.util.concurrent.atomic.AtomicBoolean

// 시스템 스플래시를 언제 걷을지. JS 첫 화면이 그려지면(SplashModule.hide) 또는 3초 안전장치가 지나면 true.
object SplashState {
  val ready = AtomicBoolean(false)
  const val SAFETY_MS = 3000L
}
