import {createContext, useCallback, useContext} from 'react';

// 화면 제목 접근성 포커스(talkback-spec R2): Screen 이 제공하고, 머리글(accessibilityRole="header")이 자기를 알린다.
// 등록은 마운트 동안만 유지된다(언마운트되면 해제). Screen 은 위 고정 영역 → 본문 순서로 지금 살아 있는 첫 머리글을 고른다.
type Register = (node: unknown) => () => void;
export const ScreenTitleContext = createContext<Register | null>(null);

// 머리글이 쓰는 ref 콜백(React 19: 반환한 정리 함수가 언마운트 때 불린다). Text20·StepHeader 등 머리글이 같은 경로로 등록한다.
export function useScreenTitleRef(isHeader: boolean) {
  const register = useContext(ScreenTitleContext);
  return useCallback(
    (node: unknown) => {
      if (!isHeader || !node || !register) {
        return undefined;
      }
      return register(node);
    },
    [isHeader, register],
  );
}
