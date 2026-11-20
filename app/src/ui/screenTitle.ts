import {createContext, useCallback, useContext} from 'react';
import {AccessibilityInfo} from 'react-native';

// 접근성 포커스 도우미 한 벌(talkback-spec R2·R12). 화면(Screen)·대화상자·시트가 모두 이것을 쓴다.

/** 화면 진입·창 열림/닫힘 직후엔 포커스가 튕기므로 300ms 뒤에 옮긴다(R2). */
export const FOCUS_DELAY_MS = 300;

/** 호스트 요소에 접근성 포커스. 보조 기능이라 실패해도 화면은 그대로. */
export function focusNode(node: unknown) {
  if (!node) return;
  try {
    AccessibilityInfo.sendAccessibilityEvent(node as never, 'focus');
  } catch {
    // 무시
  }
}

/** FOCUS_DELAY_MS 뒤에 포커스. 되돌리는 함수(타이머 정리)를 준다. getNode 는 그때의 요소를 돌려준다. */
export function focusLater(getNode: () => unknown, ms: number = FOCUS_DELAY_MS): () => void {
  const t = setTimeout(() => focusNode(getNode()), ms);
  return () => clearTimeout(t);
}

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

// 맨 위 화면의 제목(마지막에 마운트된 Screen). 사용자가 열지 않은 덮개(N1 등)가 닫히면 연 버튼이 없으니 이 제목으로 초점을 돌려준다(#168 접근성 L2).
const titleGetters: (() => unknown)[] = [];
export function registerScreenTitleGetter(get: () => unknown): () => void {
  titleGetters.push(get);
  return () => {
    const i = titleGetters.lastIndexOf(get);
    if (i >= 0) {
      titleGetters.splice(i, 1);
    }
  };
}
/** 맨 위 화면 제목으로 FOCUS_DELAY_MS 뒤 초점. 화면이 없으면 아무것도 하지 않는다 */
export function focusTopScreenTitle(): () => void {
  const get = titleGetters[titleGetters.length - 1];
  return get ? focusLater(get) : () => {};
}
