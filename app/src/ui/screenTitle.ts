import {createContext, useCallback, useContext} from 'react';

// 화면 제목 접근성 포커스(talkback-spec R2): Screen 이 제공하고, 머리글(accessibilityRole="header")이 자기를 알린다.
// 먼저 알린 머리글(위 고정 영역 → 본문 순서)이 화면 제목이다.
type Register = (node: unknown) => void;
export const ScreenTitleContext = createContext<Register | null>(null);

export function useScreenTitleRef(isHeader: boolean) {
  const register = useContext(ScreenTitleContext);
  return useCallback(
    (node: unknown) => {
      if (isHeader && node && register) {
        register(node);
      }
    },
    [isHeader, register],
  );
}
