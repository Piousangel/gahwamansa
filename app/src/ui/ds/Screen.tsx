import React, {useEffect, useState} from 'react';
import {Keyboard, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Screen as BaseScreen, type ScreenScroll} from '../Screen';
import {BackLink, type BackLinkProps} from './BackLink';
import {Dock, DockSpill, isSocialGroup, type DockProps, type DockSpillLevel} from './Dock';
import {DOCK_PAD_TOP, dockBottomPad, dockCap, nextSpill} from './dockLayout';
import {ds} from './roles';
import {MoreBand} from './MoreBand';

/** 빌드 1 구현 틀(SUMMARY Q8): step·form·intro. list·done·state 는 빌드 1 끝에(60h 안이면) */
export type ScreenVariant = 'step' | 'form' | 'intro';

/** 첫 화면(intro)은 버튼이 주인공이라 40% 예외(지금 첫 화면 RoleSelect 와 같은 0.6). 화면 파일은 비율을 고르지 못한다.
 *  단 SocialGroup 이 든 Dock 은 variant 와 상관없이 0.4(R-12 단서, PR #29 리뷰 M4) — dockRatioFor */
export const INTRO_DOCK_RATIO = 0.6;
/** variant 별 정책 한 곳(SUMMARY 2-6 'variant 가 정하는 것') */
export const VARIANT = {
  step: {dockRatio: ds.dock.maxHeightRatio, collapseOnKeyboard: true, fill: false},
  form: {dockRatio: ds.dock.maxHeightRatio, collapseOnKeyboard: true, fill: false},
  intro: {dockRatio: INTRO_DOCK_RATIO, collapseOnKeyboard: false, fill: true},
} as const;

/** Dock 상한 비율: SocialGroup 이면 0.4, 아니면 variant 값 */
export function dockRatioFor(variant: ScreenVariant, dock?: DockProps): number {
  return dock && isSocialGroup(dock.primary) ? ds.dock.maxHeightRatio : VARIANT[variant].dockRatio;
}

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

/** 자판 높이(dp, 닫혀 있으면 0). 열림 여부는 > 0 */
function useKeyboardHeight(enabled: boolean) {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const show = Keyboard.addListener('keyboardDidShow', e => setH(Math.max(1, Math.round(e?.endCoordinates?.height ?? 1))));
    const hide = Keyboard.addListener('keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);
  return enabled ? h : 0;
}

/**
 * v4 화면 틀. 옛 ui/Screen(KAV·첫 포커스·본문 페이드·토스트 자리)을 감싸고, variant 가 Dock 상한·자판 정책을 정한다.
 * Dock 이 상한을 넘으면 note → 보조 순으로 본문 끝(DockSpill)으로 보낸다. 2단계에서도 넘치면 개발 경고(테스트는 dsDockBudget 이 실패시킨다).
 */
export function DsScreen({variant, back, header, stepInfo, dock, children, scrollRef}: DsScreenProps) {
  const v = VARIANT[variant];
  const {width, height, fontScale} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight(v.collapseOnKeyboard);
  const collapsed = kb > 0;
  const [spill, setSpill] = useState<DockSpillLevel>(0);
  const ratio = dockRatioFor(variant, dock);
  // R-15(PR #29 리뷰 M3): 자판이 열리면 상한은 실제로 보이는 창(창 높이 - 자판) 기준
  const visible = Math.max(0, height - kb);
  const cap = dockCap(visible, ratio);

  // 창 크기·글자 배율·자판·Dock 문구가 바뀌면 다시 Dock 에 다 넣고 재본다(리뷰 L1)
  const dockKey = dock
    ? [isSocialGroup(dock.primary) ? dock.primary.social.map(x => x.label).join('|') : `${dock.primary.label}|${dock.primary.disabled ? dock.primary.disabledReason ?? '' : ''}|${dock.primary.loading ? 'L' : ''}`, dock.secondary?.label ?? '', dock.note?.text ?? ''].join('/')
    : '';
  useEffect(() => setSpill(0), [width, height, fontScale, kb, dockKey]);

  const onDockHeight = (content: number) => {
    if (!dock) {
      return;
    }
    const total = content + DOCK_PAD_TOP + dockBottomPad(insets.bottom);
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
      // 옛 Screen 은 창 높이 × 비율로 자른다 → 보이는 창 기준 상한과 같아지게 비율을 환산
      dockMaxRatio={height > 0 ? cap / height : ratio}
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
