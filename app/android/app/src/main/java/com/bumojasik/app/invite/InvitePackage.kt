package com.bumojasik.app.invite

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

// SplashPackage 와 같은 방식(BaseReactPackage + 레거시 모듈 인터롭). Install Referrer 1회 읽기·번호 저장 모듈 하나만
class InvitePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == InviteModule.NAME) InviteModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      InviteModule.NAME to
        ReactModuleInfo(
          name = InviteModule.NAME,
          className = InviteModule::class.java.name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = false,
        ),
    )
  }
}
