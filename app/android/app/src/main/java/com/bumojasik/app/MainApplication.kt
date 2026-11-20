package com.bumojasik.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.bumojasik.app.haptic.HapticPackage
import com.bumojasik.app.invite.InvitePackage
import com.bumojasik.app.push.PushPackage
import com.bumojasik.app.splash.SplashPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // 스플래시를 JS 첫 화면이 그려진 뒤 걷기 위한 작은 모듈(자동 연결 대상 아님)
          add(SplashPackage())
          // 카톡 초대 링크로 설치한 경우 Play Install Referrer 의 번호를 첫 실행 1회 읽는다
          add(InvitePackage())
          // P7 도장이 닿는 순간 시스템 촉각 1회(performHapticFeedback, 권한 없음·시스템 진동 설정 따름)
          add(HapticPackage())
          // 알림 채널 3개(daily·cheer·family)·앱 알림 상태·채널 설정 열기(AU-04, 권한 없음)
          add(PushPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // 번들 글꼴(F-01): XML 글꼴 묶음을 이름으로 등록 → JS fontFamily 'notosanskr' + fontWeight 로 굵기 파일을 고른다(ds/roles fontStyle)
    ReactFontManager.getInstance().addCustomFont(this, "notosanskr", R.font.notosanskr)
    ReactFontManager.getInstance().addCustomFont(this, "nanumbrushscript", R.font.nanumbrushscript)
    loadReactNative(this)
  }
}
