package com.bumojasik.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.bumojasik.app.invite.InvitePackage
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
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
