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
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * 카톡 초대 번호용 네이티브 모듈(JS: src/lib/linkSources/native.ts).
 *
 * 1) getReferrerOnce: Google Play Install Referrer 를 설치 후 "한 번만" 읽는다(공식 문서: 값은 90일간 같고 첫 실행 1회 호출 권고).
 *    - 확정 결과(OK·미지원·개발자·권한 오류)면 done 저장 → 다시 읽지 않음. 일시 실패는 다음 실행에 MAX_TRIES 번까지.
 *    - 동시 호출은 진행 중 한 번에 묶는다(리뷰 M2). 결과 읽기는 백그라운드 스레드, TIMEOUT_MS 넘으면 null(리뷰 L3).
 * 2) readStore / writeStore: 받은 번호(만료 시각 포함)를 앱 전용 SharedPreferences(MODE_PRIVATE)에 둔다(리뷰 H1).
 *    allowBackup=false 라 백업으로 기기 밖에 나가지 않는다. 값 해석·만료는 JS(inviteCode.ts).
 * 번호가 들어 있으므로 어떤 값도 로그에 남기지 않는다.
 */
class InviteModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = NAME

  private val referrerPrefs by lazy { context.getSharedPreferences(PREFS_REFERRER, Context.MODE_PRIVATE) }
  private val storePrefs by lazy { context.getSharedPreferences(PREFS_STORE, Context.MODE_PRIVATE) }

  private val lock = Any()
  private var waiting: MutableList<Promise>? = null // null 이면 진행 중인 읽기 없음

  @ReactMethod
  fun getReferrerOnce(promise: Promise) {
    synchronized(lock) {
      waiting?.let {
        it.add(promise)
        return
      }
      waiting = mutableListOf(promise)
    }
    worker.execute { readReferrer() }
  }

  private class Referrer(val referrer: String, val clickTs: Double)

  private fun settle(value: Referrer?) {
    val list = synchronized(lock) { waiting.also { waiting = null } } ?: return
    // 여러 호출자에게 같은 값을 주되 WritableMap 은 한 번만 넘길 수 있어 호출자마다 새로 만든다
    list.forEach { p ->
      p.resolve(
        value?.let {
          Arguments.createMap().apply {
            putString("referrer", it.referrer)
            putDouble("clickTs", it.clickTs)
          }
        },
      )
    }
  }

  private fun readReferrer() {
    if (referrerPrefs.getBoolean(KEY_DONE, false)) {
      settle(null)
      return
    }
    val tries = referrerPrefs.getInt(KEY_TRIES, 0)
    if (tries >= MAX_TRIES) {
      markDone()
      settle(null)
      return
    }
    referrerPrefs.edit().putInt(KEY_TRIES, tries + 1).apply()

    val client = InstallReferrerClient.newBuilder(context).build()
    val finished = java.util.concurrent.atomic.AtomicBoolean(false)
    fun finish(value: Referrer?, done: Boolean) {
      if (!finished.compareAndSet(false, true)) return
      if (done) markDone()
      try {
        client.endConnection()
      } catch (_: Exception) {
        // 이미 끊긴 연결
      }
      settle(value)
    }
    // 서비스가 콜백을 끝내 안 주면 영원히 기다리지 않게
    worker.schedule({ finish(null, done = false) }, TIMEOUT_MS, TimeUnit.MILLISECONDS)

    try {
      client.startConnection(
        object : InstallReferrerStateListener {
          override fun onInstallReferrerSetupFinished(responseCode: Int) {
            // 콜백은 메인 스레드 → 동기 Binder 호출(installReferrer)은 백그라운드에서
            worker.execute {
              when (responseCode) {
                InstallReferrerResponse.OK -> {
                  try {
                    val details = client.installReferrer
                    finish(Referrer(details.installReferrer ?: "", details.referrerClickTimestampSeconds.toDouble()), done = true)
                  } catch (_: Exception) {
                    finish(null, done = false)
                  }
                }
                // Play 스토어가 이 API 를 모름(구버전·Play 없는 기기) 등 → 다시 물어도 같다
                InstallReferrerResponse.FEATURE_NOT_SUPPORTED,
                InstallReferrerResponse.DEVELOPER_ERROR,
                InstallReferrerResponse.PERMISSION_ERROR -> finish(null, done = true)
                // SERVICE_UNAVAILABLE·SERVICE_DISCONNECTED 등 일시 실패 → 다음 실행에 재시도
                else -> finish(null, done = false)
              }
            }
          }

          override fun onInstallReferrerServiceDisconnected() {
            finish(null, done = false)
          }
        },
      )
    } catch (_: Exception) {
      // Play 서비스 바인딩 자체가 안 되는 기기
      finish(null, done = false)
    }
  }

  private fun markDone() {
    referrerPrefs.edit().putBoolean(KEY_DONE, true).apply()
  }

  @ReactMethod
  fun readStore(promise: Promise) {
    promise.resolve(storePrefs.getString(KEY_STORE, null))
  }

  // null 이면 지운다. commit(): JS 가 await 한 뒤엔 디스크에 있다(프로세스 종료에도 남게)
  @ReactMethod
  fun writeStore(value: String?, promise: Promise) {
    worker.execute {
      val ok =
        if (value == null) {
          storePrefs.edit().remove(KEY_STORE).commit()
        } else {
          storePrefs.edit().putString(KEY_STORE, value).commit()
        }
      promise.resolve(ok)
    }
  }

  companion object {
    const val NAME = "InviteModule"
    private const val PREFS_REFERRER = "install_referrer"
    private const val PREFS_STORE = "invite_store"
    private const val KEY_DONE = "done"
    private const val KEY_TRIES = "tries"
    private const val KEY_STORE = "v1"
    private const val MAX_TRIES = 3
    private const val TIMEOUT_MS = 10_000L
    private val worker = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "invite-module").apply { isDaemon = true } }
  }
}
