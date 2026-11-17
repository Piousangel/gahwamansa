package com.bumojasik.app.invite

import android.content.Intent

/**
 * /c 안내 페이지의 intent:// 버튼은 URL 조각 자리를 "#Intent;" 가 차지해서 번호를 조각에 못 싣는다.
 * 그래서 번호를 엑스트라 S.code 로 보내고(쿼리 ?code= 는 서버 접근 기록에 남을 수 있어 쓰지 않음, 리뷰 L1),
 * 여기서 data 를 https://<host>/c#<번호> 로 바꿔 JS(Linking)가 App Links 와 같은 모양으로 받게 한다.
 * host 확인은 JS(APP_LINK_HOST)가 한다. 번호는 6자리 숫자만, 엑스트라는 지운다. 로그 없음.
 */
object InviteIntent {
  private const val EXTRA_CODE = "code"
  private val CODE_RE = Regex("^\\d{6}$")

  fun moveCodeExtraToFragment(intent: Intent?) {
    if (intent == null || intent.action != Intent.ACTION_VIEW) return
    val data = intent.data ?: return
    val code = try {
      intent.getStringExtra(EXTRA_CODE)
    } catch (_: Exception) {
      null // 다른 앱이 이상한 Parcelable 을 넣은 경우
    } ?: return
    intent.removeExtra(EXTRA_CODE)
    if (data.scheme != "https" || (data.path != "/c" && data.path != "/c/") || !data.fragment.isNullOrEmpty()) return
    if (!CODE_RE.matches(code)) return
    intent.data = data.buildUpon().fragment(code).build()
  }
}
