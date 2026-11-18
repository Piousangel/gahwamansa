package com.bumojasik.app.push

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

// 알림 채널·상태 레거시 모듈(인터롭으로 노출, HapticPackage 와 같은 방식). 새 의존성 없음.
class PushPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == PushModule.NAME) PushModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      PushModule.NAME to
        ReactModuleInfo(
          name = PushModule.NAME,
          className = PushModule::class.java.name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = false,
        ),
    )
  }
}
