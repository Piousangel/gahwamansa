// 기능 스위치(앱 설정 한 곳). React 를 모른다(lib 규칙) — 화면은 features.ts 의 useFeature 가 아니라 course/fiveSteps 를 거친다.
// - fiveSteps: 오늘 코스 5단계(DECISIONS 2026-11-25 '3단계 → 5단계'·'5단계 화면 결정'·'5단계 문구 확정'). **기본 꺼짐.**
//   꺼져 있으면 3단계 화면·흐름이 그대로다(__tests__/fiveStepsOff.test.tsx 가 고정). 서버 계약(server/five-steps)이 병합되기 전에는
//   realApi 의 ②·⑤ 저장이 연결되지 않아 fake 모드에서만 끝까지 돈다.
// - 켜는 길: staging·개발 빌드의 개발자 메뉴(DevMenuHost — production 번들에는 들어가지 않는다). 메뉴가 기기에 남긴 값을 앱 시작 때 다시 읽는다.
export type FeatureName = 'fiveSteps';
type Flags = Record<FeatureName, boolean>;

export const FEATURE_DEFAULTS: Readonly<Flags> = Object.freeze({fiveSteps: false});

let flags: Flags = {...FEATURE_DEFAULTS};
const listeners = new Set<() => void>();

export function isFeatureOn(name: FeatureName): boolean {
  return flags[name];
}

/** 개발자 메뉴·테스트만 부른다. 바뀌면 구독자(화면)에게 알린다 */
export function setFeature(name: FeatureName, on: boolean) {
  if (flags[name] === on) {
    return;
  }
  flags = {...flags, [name]: on};
  listeners.forEach(l => l());
}

export function subscribeFeatures(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** 테스트용: 모든 스위치를 기본값(꺼짐)으로 */
export function resetFeaturesForTest() {
  flags = {...FEATURE_DEFAULTS};
  listeners.forEach(l => l());
}

/** 개발자 메뉴가 기기에 남기는 키(staging·개발 빌드만 쓰고 읽는다) */
export const DEV_FEATURE_KEY = 'dev_feature_five_steps';
