// 공개 전 배경 음악(bgmAsset.ts RELEASED=false)의 production 출시 번들 대역(l2-appinfo 리뷰 L7).
// 사람이 아직 귀로 확인하지 않은 음원 파일이 production APK(res/raw)에 들어가지 않게 require 가 없다.
// metroDevMenu.devMenuRedirect 가 production 이고 RELEASED=false 일 때만 이 파일로 바꾼다. API 는 bgmAsset.ts 와 같다.
export type BgmTrack = 'home' | 'done';

export function bgmAsset(_which: BgmTrack = 'home'): number | string | null {
  return null;
}
export function setBgmPreview(_on: boolean) {}
export function bgmPreview(): boolean {
  return false;
}
export function setBgmAssetForTest(_next: number | string | null | undefined) {}
