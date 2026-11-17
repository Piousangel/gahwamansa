package com.bumojasik.app.splash

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

// 새 아키텍처 권장 방식(BaseReactPackage). 스플래시를 걷는 hide() 하나만 있는 레거시 모듈(인터롭으로 노출)
class SplashPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == SplashModule.NAME) SplashModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      SplashModule.NAME to
        ReactModuleInfo(
          name = SplashModule.NAME,
          className = SplashModule::class.java.name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = false,
        ),
    )
  }
}
