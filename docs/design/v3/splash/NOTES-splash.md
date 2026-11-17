# 스플래시 설계 메모 (2026-11-17, 토스 디자이너)
시안: `SPL_A.dc.html`(추천, 심볼만 + 첫 화면으로 이어지는 데모), `SPL_B.dc.html`(아래 워드마크 추가). 렌더: `_render/`.

## 원칙
- 스플래시는 "앱이 켜지고 있다"는 표시만 한다. 글자·움직임은 첫 화면에 맡긴다.
- 배경을 paper `#F6F3EE` 하나로 통일한다. 시스템 스플래시, JS 대기 화면, 첫 화면 배경이 같아서 색이 바뀌는 순간이 없다.
- 심볼은 한 번도 사라지지 않는다. 시스템 스플래시 가운데 → JS 대기(같은 자리·같은 크기) → 첫 화면 워드마크 옆 자리로 이동.

## 에셋 명세
| 항목 | 값 |
|---|---|
| 배경 | paper `#F6F3EE`. `windowSplashScreenBackground`·`windowBackground`·`postSplashScreenTheme`의 바탕도 같은 색(다크 모드도 고정) |
| 아이콘 | `symbol-sun-polaroid.svg` → Android VectorDrawable(`res/drawable/splash_symbol.xml`). 래스터를 쓰지 않음 |
| 아이콘 캔버스 | 288x288dp(아이콘 배경 없음). 심볼은 가운데 128dp. 지름 192dp 안전 원 안에 들어감(기울인 틀의 대각선 약 137dp) |
| 아이콘 배경색 | 쓰지 않음(`windowSplashScreenIconBackgroundColor` 없음) |
| 아이콘 애니메이션 | 없음(정적). AVD는 12+ 전용이고 실행이 짧으면 잘린다 |
| 브랜딩 이미지 | A: 없음. B: 200x80dp 워드마크 벡터(글꼴 라이선스 확인 후 글자를 경로로 변환) |
| JS 대기 글자 | 2초가 넘으면 심볼 아래 24dp에 "잠시만요"(20, #85592F, 5.47, 확대 상한 2.0). 기존 `app.loading` 문구 재사용 |

## 타이밍 (JS 첫 프레임이 그려진 순간 = 0)
| 경우 | 동작 |
|---|---|
| 처음 설치(역할 선택 전) | 0: 네이티브 스플래시를 숨김(JS 화면과 같은 모습이라 바뀐 게 안 보임) → 0~450: 심볼이 화면 가운데 128 → 워드마크 옆 40으로 translate+scale, (.4,0,.2,1) → 150~450: 워드마크·제목·질문·버튼 opacity 0→1 → 450~: D 모션(심볼 rise 빼고, 항목 150ms부터) 재생. 버튼은 450ms부터 또렷하게 보이고 바로 누를 수 있다. 전체 약 2.1초 |
| 복원(코스 홈·자녀 홈으로 바로 감) | 심볼 그대로 대기 → 이동할 곳이 정해지면 300ms 페이드 전환. 2초가 넘으면 "잠시만요" |
| 동작 줄이기 | 이동 없음. 스플래시 심볼 300ms 페이드아웃, 첫 화면 300ms 페이드인(D의 줄인 모션) |
- 지금 잠깐 보이는 "잠시만요" 글자 화면(AppRoot loading 분기)은 ③ JS 대기 화면(심볼만)으로 바꾼다. 글자는 2초가 넘을 때만 보인다.

## 구현 메모 (추천: 추가 의존성 최소)
- **androidx `core-splashscreen`**(Gradle 한 줄)만 쓴다. Android 12+에서는 시스템 SplashScreen API, minSdk 24~30에서는 같은 모습을 compat으로 보여 준다(compat에서는 아이콘 애니메이션·브랜딩 이미지가 안 됨 → A안이 기기마다 같은 모습).
- 테마: `Theme.App.Starting`(parent `Theme.SplashScreen`) + `windowSplashScreenBackground=@color/paper`, `windowSplashScreenAnimatedIcon=@drawable/splash_symbol`, `postSplashScreenTheme=@style/AppTheme`. Manifest의 Activity 테마를 Starting으로 바꾼다.
- `MainActivity.onCreate`에서 `installSplashScreen()`을 호출한 뒤 `setKeepOnScreenCondition { !jsReady }`. `jsReady`는 아주 작은 네이티브 모듈(`SplashModule.hide()`, Kotlin 20줄 안팎)로 JS 첫 화면이 `onLayout`된 뒤 켠다. 이렇게 하면 RN이 빈 화면을 그리는 순간을 덮어 깜박임이 없다. 안전장치로 3초가 지나면 자동으로 숨긴다.
- 대안 `react-native-bootsplash`: 위 작업(에셋 생성, hide, iOS LaunchScreen)을 묶어 주지만 RN 0.88 호환은 확인하지 않았다. iOS 출시 때 다시 검토한다.
- JS 쪽은 `SplashHold` 컴포넌트를 신설한다(화면 전체 기준 가운데 심볼 128). RoleSelect의 `BrandSymbol`은 처음 마운트 때 `measureInWindow`로 목표 위치를 재고, 날아오는 심볼(absolute, `Animated` translate+scale, `useNativeDriver: true`)이 도착하면 진짜 심볼로 바꾼다.
- 중앙 정렬 기준: 시스템 스플래시는 상태·내비게이션 바를 포함한 창 전체의 가운데다. JS도 edge-to-edge 창 전체 기준으로 맞춰야 위치가 튀지 않는다(실기기 확인 필요).

## 확인한 것 / 미확인
- 렌더: 320/360/390/412/430 시스템 스플래시, 대기 화면 100·200%(320·360)에서 심볼 중심이 화면 가운데, 넘침 0. 이어지기 데모는 프레임 6장(일반·동작 줄이기)으로 직접 봤다.
- 미확인: 실기기 Android 12+ 스플래시가 아이콘을 실제로 얼마나 크게 그리는지(OEM 차이), compat 모습, 콜드 스타트 시간, iOS.
