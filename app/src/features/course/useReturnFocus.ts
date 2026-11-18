import {useCallback, useEffect, useRef} from 'react';
import {AccessibilityInfo} from 'react-native';
import {focusLater} from '../../ui/screenTitle';

type Nav = {addListener(name: 'focus', cb: () => void): () => void};

// 포커스 규칙(로드맵 §5 D-10, AP-11): 화면에 새로 들어오면 제목(Screen 이 마운트 때), 뒤로 돌아오면 떠날 때 누른 요소로.
// - bind(key): 누를 수 있는 요소의 ref. mark(key): 그 요소로 다른 화면에 갈 때 부른다.
// - 돌아와(focus) 위 화면이 닫히는 전환이 끝난 뒤(afterTransition) 화면 읽기가 켜져 있으면 그 요소로, 그 요소가 없어졌으면 제목으로.
//   (예: 단계를 마치고 돌아오면 같은 자리의 주 버튼이 다음 단계 이름으로 바뀌어 있다 → 그 버튼)
export function useReturnFocus(navigation: Nav, afterTransition: (f: () => void) => void, fallback: () => unknown) {
  const nodes = useRef(new Map<string, unknown>());
  const refs = useRef(new Map<string, (node: unknown) => () => void>());
  const last = useRef<string | null>(null);
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const bind = useCallback((key: string) => {
    let r = refs.current.get(key);
    if (!r) {
      r = (node: unknown) => {
        if (node) {
          nodes.current.set(key, node);
        }
        return () => {
          if (nodes.current.get(key) === node) {
            nodes.current.delete(key);
          }
        };
      };
      refs.current.set(key, r);
    }
    return r;
  }, []);
  const mark = useCallback((key: string) => {
    last.current = key;
  }, []);

  useEffect(() => {
    let cancel: (() => void) | null = null;
    const off = navigation.addListener('focus', () => {
      const key = last.current;
      if (key === null) {
        return;
      }
      last.current = null;
      AccessibilityInfo.isScreenReaderEnabled()
        .then(on => {
          if (on) {
            afterTransition(() => {
              cancel?.();
              cancel = focusLater(() => nodes.current.get(key) ?? fallbackRef.current());
            });
          }
        })
        .catch(() => {});
    });
    return () => {
      off();
      cancel?.();
    };
  }, [navigation, afterTransition]);

  return {bind, mark};
}
