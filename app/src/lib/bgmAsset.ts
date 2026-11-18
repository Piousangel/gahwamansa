// 배경 음악 음원(AP-04, 시안 PX_music). React 를 모른다(lib 규칙).
// 음원은 CT-04(Lyria 2곡 생성·검수, 사용자 비용 승인 대기)가 res/raw 에 넣는다. 그 전까지 null → 음악 관련 화면 요소를 모두 숨긴다
// (P3 '음악 켜기/끄기', P7 첫 완료 권유·미리 듣기, P13 '배경 음악' 행). 음원이 오면 여기 한 줄만 바꾼다(예: 'bgm_album_1').
// TODO(CT-04): 음원 res/raw 이름으로 교체. 볼륨 30%·2초 페이드는 L4(audioCore bgm).
let asset: number | string | null = null;

export function bgmAsset(): number | string | null {
  return asset;
}

/** 테스트용: 음원이 있는 상태를 흉내 낸다(null 이면 숨김으로 돌아감). */
export function setBgmAssetForTest(next: number | string | null) {
  asset = next;
}
