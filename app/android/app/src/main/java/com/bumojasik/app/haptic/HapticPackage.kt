package com.bumojasik.app.haptic

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

// 시스템 촉각 confirm() 하나만 있는 레거시 모듈(인터롭으로 노출, SplashPackage 와 같은 방식). 새 의존성 없음.
class HapticPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == HapticModule.NAME) HapticModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      HapticModule.NAME to
        ReactModuleInfo(
          name = HapticModule.NAME,
          className = HapticModule::class.java.name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = false,
        ),
    )
  }
}
