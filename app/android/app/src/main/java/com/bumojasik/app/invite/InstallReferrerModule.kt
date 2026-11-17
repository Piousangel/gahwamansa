package com.bumojasik.app.invite

import android.content.Context
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerClient.InstallReferrerResponse
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Google Play Install Referrer 를 설치 후 "한 번만" 읽는다(공식 문서 권고: 정보는 90일간 같고, 첫 실행에 1회만 호출).
 * - 결과가 확정되면(OK·미지원·개발자 오류) 기기 SharedPreferences 에 done 을 남겨 다시 읽지 않는다 → 같은 번호 재사용 방지.
 * - 일시 실패(SERVICE_UNAVAILABLE·연결 끊김)는 다음 실행에 다시 시도하되 MAX_TRIES 번까지만.
 * - referrer 원문은 JS 로만 넘기고 로그·분석에 남기지 않는다(초대 번호가 들어 있음). 해석·검증은 JS(src/lib/linkSources).
 * 스파이크: docs/team/spikes/2026-11-17-install-referrer-applinks.md
 */
class InstallReferrerModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = NAME

  private val prefs by lazy { context.getSharedPreferences(PREFS, Context.MODE_PRIVATE) }

  @ReactMethod
  fun getOnce(promise: Promise) {
    if (prefs.getBoolean(KEY_DONE, false)) {
      promise.resolve(null)
      return
    }
    val tries = prefs.getInt(KEY_TRIES, 0)
    if (tries >= MAX_TRIES) {
      markDone()
      promise.resolve(null)
      return
    }
    prefs.edit().putInt(KEY_TRIES, tries + 1).apply()

    val settled = AtomicBoolean(false)
    val client = InstallReferrerClient.newBuilder(context).build()
    fun finish(value: Any?, done: Boolean) {
      if (!settled.compareAndSet(false, true)) return
      if (done) markDone()
      try {
        client.endConnection()
      } catch (_: Exception) {
        // 이미 끊긴 연결
      }
      promise.resolve(value)
    }

    try {
      client.startConnection(
        object : InstallReferrerStateListener {
          override fun onInstallReferrerSetupFinished(responseCode: Int) {
            when (responseCode) {
              InstallReferrerResponse.OK -> {
                try {
                  val details = client.installReferrer
                  val map = Arguments.createMap()
                  map.putString("referrer", details.installReferrer ?: "")
                  map.putDouble("clickTs", details.referrerClickTimestampSeconds.toDouble())
                  finish(map, done = true)
                } catch (_: Exception) {
                  finish(null, done = false)
                }
              }
              // Play 스토어가 이 API 를 모름(구버전·Play 없는 기기) → 다시 물어도 같다
              InstallReferrerResponse.FEATURE_NOT_SUPPORTED,
              InstallReferrerResponse.DEVELOPER_ERROR,
              InstallReferrerResponse.PERMISSION_ERROR -> finish(null, done = true)
              // SERVICE_UNAVAILABLE·SERVICE_DISCONNECTED 등 일시 실패 → 다음 실행에 재시도
              else -> finish(null, done = false)
            }
          }

          override fun onInstallReferrerServiceDisconnected() {
            finish(null, done = false)
          }
        },
      )
    } catch (_: Exception) {
      // Play 서비스 바인딩 자체가 안 되는 기기(에뮬레이터 Play 없음 등)
      finish(null, done = false)
    }
  }

  private fun markDone() {
    prefs.edit().putBoolean(KEY_DONE, true).apply()
  }

  companion object {
    const val NAME = "InstallReferrerModule"
    private const val PREFS = "install_referrer"
    private const val KEY_DONE = "done"
    private const val KEY_TRIES = "tries"
    private const val MAX_TRIES = 3
  }
}
