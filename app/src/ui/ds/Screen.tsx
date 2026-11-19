import React, {useEffect, useState} from 'react';
import {Keyboard, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Screen as BaseScreen, type ScreenScroll} from '../Screen';
import {BackLink, type BackLinkProps} from './BackLink';
import {Dock, DockSpill, type DockProps, type DockSpillLevel} from './Dock';
import {dockCap, nextSpill} from './dockLayout';
import {ds} from './roles';
import {MoreBand} from './MoreBand';

/** 빌드 1 구현 틀(SUMMARY Q8): step·form·intro. list·done·state 는 빌드 1 끝에(60h 안이면) */
export type ScreenVariant = 'step' | 'form' | 'intro';

/** 첫 화면(intro)은 버튼이 주인공이라 40% 예외(지금 첫 화면 RoleSelect 와 같은 0.6). 화면 파일은 비율을 고르지 못한다 */
export const INTRO_DOCK_RATIO = 0.6;
/** variant 별 정책 한 곳(SUMMARY 2-6 'variant 가 정하는 것') */
export const VARIANT = {
  step: {dockRatio: ds.dock.maxHeightRatio, collapseOnKeyboard: true, fill: false},
  form: {dockRatio: ds.dock.maxHeightRatio, collapseOnKeyboard: true, fill: false},
  intro: {dockRatio: INTRO_DOCK_RATIO, collapseOnKeyboard: false, fill: true},
} as const;

// 옛 Screen 의 Dock 안쪽 위아래 여백(위 12-6, 아래 max(28, 16 + insets.bottom)) — 넘침 판단에 더한다
const DOCK_PAD_TOP = 6;

export type DsScreenProps = {
  variant: ScreenVariant;
  /** 왼쪽 위 뒤로(스택 화면). 자판이 열려도 남는 한 줄 */
  back?: BackLinkProps;
  /** 위 영역(단계 머리·화면 제목). form·step 은 자판이 열리면 접힌다 */
  header?: React.ReactNode;
  /** 접혔을 때 BackLink 가 읽어 주는 단계 정보 */
  stepInfo?: string;
  dock?: DockProps;
  children: React.ReactNode;
  scrollRef?: React.Ref<ScreenScroll>;
};

function useKeyboardOpen(enabled: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);
  return enabled && open;
}

/**
 * v4 화면 틀. 옛 ui/Screen(KAV·첫 포커스·본문 페이드·토스트 자리)을 감싸고, variant 가 Dock 상한·자판 정책을 정한다.
 * Dock 이 상한을 넘으면 note → 보조 순으로 본문 끝(DockSpill)으로 보낸다. 2단계에서도 넘치면 개발 경고(테스트는 dsDockBudget 이 실패시킨다).
 */
export function DsScreen({variant, back, header, stepInfo, dock, children, scrollRef}: DsScreenProps) {
  const v = VARIANT[variant];
  const {width, height, fontScale} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const collapsed = useKeyboardOpen(v.collapseOnKeyboard);
  const [spill, setSpill] = useState<DockSpillLevel>(0);

  // 창 크기·글자 배율이 바뀌면 다시 Dock 에 다 넣고 재본다
  useEffect(() => setSpill(0), [width, height, fontScale]);

  const cap = dockCap(height, v.dockRatio);
  const onDockHeight = (content: number) => {
    if (!dock) {
      return;
    }
    const total = content + DOCK_PAD_TOP + Math.max(ds.dock.padding.bottomMin, 16 + insets.bottom);
    setSpill(level => {
      const next = nextSpill(level, total, cap, {secondary: !!dock.secondary, note: !!dock.note});
      if (next === level && total > cap && __DEV__) {
        console.warn(`[DS] Dock 이 상한(${cap})을 넘어요(${total}). 슬롯 문구를 줄이거나 행동을 본문으로 옮기세요.`);
      }
      return next;
    });
  };

  const top =
    back || header ? (
      <View style={styles.top} testID="ds-screen-top">
        {back ? <BackLink {...back} context={collapsed ? stepInfo ?? back.context : back.context} /> : null}
        {collapsed ? null : header}
      </View>
    ) : undefined;

  return (
    <BaseScreen
      top={top}
      fill={v.fill}
      dockMaxRatio={v.dockRatio}
      scrollRef={scrollRef}
      moreBand={<MoreBand />}
      bottom={dock ? <Dock {...dock} spill={spill} onContentHeight={onDockHeight} /> : undefined}>
      {children}
      {dock ? <DockSpill secondary={dock.secondary} note={dock.note} spill={spill} /> : null}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  top: {gap: ds.space.group, paddingBottom: ds.space.group},
});
