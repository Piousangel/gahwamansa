import {useCallback, useState} from 'react';
import type {ImageLoadEvent} from 'react-native';
import {photoAspect} from './photoFrame';

/**
 * P4 사진 불러오기 상태(원본 비율·다 불러옴·실패)를 사진 주소에 묶는다(#234 L2).
 * 같은 화면에서 콘텐츠를 다시 받아 주소가 바뀌면 이전 사진의 비율·상태가 남지 않는다(초기화 effect·추가 렌더 없이 주소 비교로).
 */
export function usePhotoLoad(url: string | undefined) {
  const [state, setState] = useState<{url?: string; aspect: number | null; loaded: boolean; failed: boolean}>({aspect: null, loaded: false, failed: false});
  const mine = state.url === url;
  const onLoad = useCallback(
    (e?: ImageLoadEvent) => {
      const src = e?.nativeEvent?.source; // 크기를 못 받으면 콘텐츠 비율 틀(잘라 내지는 않음)
      setState({url, aspect: photoAspect(src?.width, src?.height), loaded: true, failed: false});
    },
    [url],
  );
  const onError = useCallback(() => setState({url, aspect: null, loaded: false, failed: true}), [url]);
  return {aspect: mine ? state.aspect : null, loaded: mine && state.loaded, failed: mine && state.failed, onLoad, onError};
}
