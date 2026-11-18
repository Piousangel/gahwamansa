// 배경 음악 음원(AP-04, 시안 PX_music, CT-04 Lyria 2곡: content/audio → src/assets/bgm). React 를 모른다(lib 규칙).
// - home: 코스 홈(P3), done: 마친 화면(P7).
// - 공개 스위치: RELEASED. 사용자가 실기기 스피커로 듣고 확인하기 전까지 false → 음악 관련 화면 요소를 모두 숨긴다
//   (P3 '음악 켜기/끄기', P7 첫 완료 권유·미리 듣기, P13 '배경 음악' 행·AI 음악 고지). 확인되면 이 한 줄만 true 로.
// - staging·개발 빌드는 개발자 메뉴 '배경 음악 미리 듣기'로 이 실행 동안만 켤 수 있다(setBgmPreview). production 은 관문이 막는다.
// 볼륨 30%·2초 페이드는 L4(audioCore bgm).
export type BgmTrack = 'home' | 'done';

const RELEASED = false; // TODO(사용자 실기기 청취 확인): true 로 바꾸면 모든 빌드에서 음악 요소가 보인다

let preview = false;
let testOverride: number | string | null | undefined;

function track(which: BgmTrack): number {
  // 번들 자산(debug = Metro 주소, release = res/raw). require 는 정적 경로여야 한다
  return which === 'done' ? require('../assets/bgm/bgm_done.m4a') : require('../assets/bgm/bgm_home.m4a');
}

/** 그 화면의 음원. 공개 전(RELEASED false)이고 미리 듣기도 꺼져 있으면 null(화면은 음악 요소를 그리지 않음) */
export function bgmAsset(which: BgmTrack = 'home'): number | string | null {
  if (testOverride !== undefined) {
    return testOverride;
  }
  return RELEASED || preview ? track(which) : null;
}

/** 개발자 메뉴(staging·개발 빌드): 이 실행 동안만 음악 요소를 보이게 한다 */
export function setBgmPreview(on: boolean) {
  preview = on;
}
export function bgmPreview(): boolean {
  return preview;
}

/** 테스트용: 음원이 있는 상태를 흉내 낸다(null 이면 숨김, undefined 면 실제 규칙으로). */
export function setBgmAssetForTest(next: number | string | null | undefined) {
  testOverride = next === null ? undefined : next;
}
