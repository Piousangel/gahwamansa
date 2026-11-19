import React, {useEffect, useRef, useState} from 'react';
import {Keyboard, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Screen as BaseScreen, type ScreenScroll} from '../Screen';
import {BackLink, type BackLinkProps} from './BackLink';
import {Dock, DockSpill, isSocialGroup, type DockProps, type DockSpillLevel} from './Dock';
import {DOCK_PAD_TOP, dockBottomPad, dockCap, nextSpill} from './dockLayout';
import {ds} from './roles';
import {MoreBand, MORE_BAND_H} from './MoreBand';
import {Button} from './Button';

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
  /** 본문 맨 끝(Dock 에서 넘친 슬롯 뒤). 예: C0 '부모님이시면 처음으로' 출구는 넘친 이메일 링크보다 아래(시안 C0 v4 200%) */
  tail?: React.ReactNode;
  /** R-12 예외(디자인 #74)를 켠다: 자판이 열린 채 주 버튼 하나만으로도 보이는 창 40%를 넘으면 Dock 을 풀고 주 버튼을 본문(children 뒤·tail 앞)에.
   *  입력 화면(C0-b 등)만 켠다. 끈 화면(기본)은 Dock 유지 — 예: P6 는 200% 자판 열림에서도 '다 썼어요'를 Dock 에(V4-INDEX, PR #82 리뷰 L2) */
  dockReleaseOnKeyboard?: boolean;
  /** 접힘 기준 창 높이(R-15) = 본문 영역 − '더 있음' 띠. 띠 유무와 무관해 스크롤 끝에서 흔들리지 않는다(PR #83 재확인 H1) */
  onViewport?: (h: number) => void;
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
export function DsScreen({variant, back, header, stepInfo, dock, children, tail, scrollRef, dockReleaseOnKeyboard = false, onViewport}: DsScreenProps) {
  const v = VARIANT[variant];
  const {width, height, fontScale} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight(v.collapseOnKeyboard);
  const collapsed = kb > 0;
  const [spill, setSpillState] = useState<DockSpillLevel>(0);
  // PR #82 리뷰 L4: 한 번 그리는 사이 onLayout 이 두 번 와도 오래된 값으로 판단하지 않게 지금 값을 ref 로도 든다
  const spillRef = useRef<DockSpillLevel>(0);
  const setSpill = (n: DockSpillLevel) => {
    spillRef.current = n;
    setSpillState(n);
  };
  const ratio = dockRatioFor(variant, dock);
  // R-15(PR #29 리뷰 M3): 자판이 열리면 상한은 실제로 보이는 창(창 높이 - 자판) 기준
  const visible = Math.max(0, height - kb);
  const cap = dockCap(visible, ratio);

  // 창 크기·글자 배율·자판·Dock 문구가 바뀌면 다시 Dock 에 다 넣고 재본다(리뷰 L1).
  const dockKey = dock
    ? [isSocialGroup(dock.primary) ? dock.primary.social.map(x => x.label).join('|') : `${dock.primary.label}|${dock.primary.disabled ? dock.primary.disabledReason ?? '' : ''}|${dock.primary.loading ? 'L' : ''}|${dock.primary.kind ?? ''}|${dock.primary.icon ?? ''}`, `${dock.secondary?.label ?? ''}|${dock.secondary?.kind ?? ''}|${dock.secondary?.icon ?? ''}`, dock.note?.text ?? ''].join('/') // PR #83 리뷰 L3: Dock 높이를 바꾸는 kind·icon 도
    : '';
  // R-12 예외(디자인 결정 11-19, PR #74): 자판이 열린 채 주 버튼 하나만으로도 보이는 창의 40%를 넘으면 Dock 을 풀고
  //   주 버튼을 본문(입력 바로 아래, children 뒤·tail 앞)에 둔다. 자판이 닫히면 다시 Dock. 소셜 묶음은 해당 없음(자판 없는 화면)
  //   PR #82 리뷰 L3: 같은 조건(창·배율·자판·문구)에서 한 번 풀렸으면 기억해, 다시 그 조건이 되면 Dock 을 그렸다 지우는 프레임 없이 바로 푼다
  const [undock, setUndock] = useState(false);
  const releasedFor = useRef(new Set<string>());
  const condKey = `${width}|${height}|${fontScale}|${kb}|${dockKey}`;
  useEffect(() => {
    const known = releasedFor.current.has(condKey);
    spillRef.current = known ? 2 : 0;
    setSpillState(known ? 2 : 0);
    setUndock(known);
  }, [condKey]);

  const onDockHeight = (content: number, rendered: DockSpillLevel = spillRef.current) => {
    if (!dock) {
      return;
    }
    // PR #83 리뷰 L4: 지금 단계로 그린 Dock 의 측정만 쓴다(한 번 그리기 전에 온 두 번째 측정은 옛 배치라 버린다, P1 M9 와 같은 원칙)
    if (rendered !== spillRef.current) {
      return;
    }
    // 자판이 열리면 아래 내비 inset 은 자판이 덮는다 → 재는 높이에서 뺀다(리드 지시 11-19, R-12 예외 측정)
    const total = content + DOCK_PAD_TOP + dockBottomPad(kb > 0 ? 0 : insets.bottom);
    const level = spillRef.current;
    const next = nextSpill(level, total, cap, {secondary: !!dock.secondary, note: !!dock.note});
    if (next !== level) {
      setSpill(next);
      return;
    }
    if (total > cap) {
      if (kb > 0) {
        // 소셜 묶음 화면에는 입력이 없다: 자판은 스택 위 다른 화면 것(C0-a 가 C0-b 밑에 남아 있을 때) → 풀지도 경고하지도 않는다
        if (dockReleaseOnKeyboard && !isSocialGroup(dock.primary)) {
          releasedFor.current.add(condKey);
          setUndock(true);
        }
      } else if (__DEV__) {
        console.warn(`[DS] Dock 이 상한(${cap})을 넘어요(${total}). 슬롯 문구를 줄이거나 행동을 본문으로 옮기세요.`);
      }
    }
  };
  const primary = dock && !isSocialGroup(dock.primary) ? dock.primary : null;

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
      onBodyArea={onViewport ? h => onViewport(h - MORE_BAND_H) : undefined}
      moreBand={<MoreBand />}
      bottom={dock && !undock ? <Dock {...dock} spill={spill} onContentHeight={onDockHeight} /> : undefined}>
      {children}
      {undock && primary ? (
        <View testID="dock-undocked">
          <Button
            kind={primary.kind ?? 'primary'}
            size="dock"
            label={primary.label}
            onPress={primary.onPress}
            disabled={primary.disabled}
            loading={primary.loading}
            loadingLabel={primary.loadingLabel}
            disabledReason={primary.disabledReason}
            icon={primary.icon}
            accessibilityHint={primary.accessibilityHint}
            testID={primary.testID}
          />
        </View>
      ) : null}
      {dock ? <DockSpill secondary={dock.secondary} note={dock.note} spill={undock ? 2 : spill} /> : null}
      {tail}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  top: {gap: ds.space.group, paddingBottom: ds.space.group},
});
