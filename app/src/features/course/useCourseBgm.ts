import {useCallback, useEffect, useState} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {useBgm} from '../../audio';
import {bgmAsset, type BgmTrack} from '../../lib/bgmAsset';
import {prefs} from '../../lib/prefs';
import {useScreenReader} from '../../ui/a11y';

// AP-04 배경 음악을 코스 홈(P3)·마친 화면(P7)에 잇는다(시안 PX_music, DECISIONS 11-17: 기본 꺼짐, 이 두 화면만).
// - 음원(CT-04)이 없으면 available=false → 화면은 음악 요소를 그리지 않는다.
// - 이 화면이 보일 때만 튼다(다른 화면이 위에 쌓이면 멈춤). 판단(무음·화면 읽기·백그라운드·덕킹)은 audio/useBgm·audioPolicy.
// - 켬/끔은 기기 설정(prefs). 화면에 돌아올 때 다시 읽어 설정 화면에서 바꾼 값이 반영된다.
export function useCourseBgm(which: BgmTrack) {
  const asset = bgmAsset(which);
  const focused = useIsFocused();
  const screenReader = useScreenReader();
  const [enabled, setEnabledState] = useState(false);
  useEffect(() => {
    if (!focused || asset === null) {
      return undefined;
    }
    let alive = true;
    prefs()
      .bgmEnabled()
      .then(v => alive && setEnabledState(v));
    return () => {
      alive = false;
    };
  }, [focused, asset]);
  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    prefs().setBgmEnabled(v);
  }, []);
  useBgm(asset, {enabled: asset !== null && enabled, screen: focused});
  // 화면 읽기가 켜져 있으면 음악은 정책상 멈추므로 버튼도 숨긴다(R16과 같은 원칙)
  return {available: asset !== null && !screenReader, enabled, setEnabled};
}
