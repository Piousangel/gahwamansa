// 토스트 자리 규칙(UX U2, 시안 C4_title_dup '토스트 위치 규칙'): 화면 맨 아래 '가장 위에 있는 고정 요소' 바로 위 12.
//  - 하단 고정 버튼이 있으면(Screen dock) 그 위 12. 탭 화면이면 탭 막대 위에 있는 dock 위 12
//  - 하단 고정이 없으면: 탭 막대 위 12, 탭도 없으면 안전 영역 + 24
//  - 시트·대화상자가 열려 있으면 띄우지 않는다(닫힌 뒤 보인다)
// Screen 이 dock 높이를 알리고(지금 보이는 화면만), BottomSheet·Dialog 가 열림을 알린다. ui 안에서만 쓰는 작은 통로.
import {createContext, useContext, useEffect, useRef} from 'react';
import {NavigationContext} from '@react-navigation/native';

export const TOAST_GAP_ABOVE = 12;
export const TOAST_GAP_BOTTOM = 24;

export function toastBottom(p: {dock: number; tabOffset: number; insetBottom: number}): number {
  if (p.dock > 0) {
    return p.tabOffset + p.dock + TOAST_GAP_ABOVE;
  }
  return p.tabOffset > 0 ? p.tabOffset + TOAST_GAP_ABOVE : p.insetBottom + TOAST_GAP_BOTTOM;
}

export type ToastPlacement = {
  reportDock: (id: object, height: number | null) => void;
  modal: (open: boolean) => void;
  /** 탭 막대의 실제 높이(안전 영역 포함). 글자 200%에서 막대가 커져도 토스트가 겹치지 않게(#199 캡처 L) */
  reportTabBar: (height: number | null) => void;
};
export const ToastPlacementContext = createContext<ToastPlacement>({reportDock: () => {}, modal: () => {}, reportTabBar: () => {}});

/** 탭 막대용: onLayout 에 걸면 실제 높이를 토스트 자리에 알린다. 사라지면 거둔다 */
export function useReportTabBar(): (e: {nativeEvent: {layout: {height: number}}}) => void {
  const {reportTabBar} = useContext(ToastPlacementContext);
  useEffect(() => () => reportTabBar(null), [reportTabBar]);
  return e => reportTabBar(Math.ceil(e.nativeEvent.layout.height));
}

/** Screen 용: 이 화면의 dock 높이를 알린다. 내비게이션 안이면 보일 때(focus)만, 가려지면(blur) 거둔다 */
export function useReportDock(height: number) {
  const {reportDock} = useContext(ToastPlacementContext);
  const nav = useContext(NavigationContext);
  const id = useRef({}).current;
  const focused = useRef(nav ? nav.isFocused() : true);
  const h = useRef(height);
  h.current = height;
  useEffect(() => {
    if (focused.current) {
      reportDock(id, height);
    }
  }, [height, id, reportDock]);
  useEffect(() => {
    if (!nav) {
      return () => reportDock(id, null);
    }
    const offFocus = nav.addListener('focus', () => {
      focused.current = true;
      reportDock(id, h.current);
    });
    const offBlur = nav.addListener('blur', () => {
      focused.current = false;
      reportDock(id, null);
    });
    return () => {
      offFocus();
      offBlur();
      reportDock(id, null);
    };
  }, [nav, id, reportDock]);
}

/** BottomSheet·Dialog 용: 열려 있는 동안 토스트를 숨긴다 */
export function useToastModalGuard(visible: boolean) {
  const {modal} = useContext(ToastPlacementContext);
  useEffect(() => {
    if (!visible) {
      return;
    }
    modal(true);
    return () => modal(false);
  }, [visible, modal]);
}
