import React from 'react';
import {StyleSheet, View, type LayoutChangeEvent, type Pressable} from 'react-native';
import {Button} from './Button';
import {SocialButton, type SocialButtonProps} from './SocialButton';
import {Text} from './Text';
import {ds} from './roles';
import type {IconName} from '../assets/icons';

// Dock 슬롯(SUMMARY 2-4·Q1): 주 1 + 보조 0~1 + 한 줄 note 까지만. 자식(children)을 받지 않아 다른 것을 넣으면 타입 에러다.
// 약관 같은 글은 Dock 이 아니라 본문 끝에 둔다. 200%에서 넘치면 note → 보조 순으로 본문 끝으로 보낸다(Screen 이 판단).

export type DockAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  disabledReason?: string;
  icon?: IconName;
  accessibilityHint?: string;
  testID?: string;
  /** 누른 뒤 돌아왔을 때 포커스를 되돌릴 대상(D-10, 코스 홈 주 버튼) */
  buttonRef?: React.Ref<React.ComponentRef<typeof Pressable>>;
  social?: never;
};

type Social<P extends SocialButtonProps['provider']> = Omit<SocialButtonProps, 'testID' | 'provider'> & {provider: P};
/**
 * 소셜 로그인 묶음(PR #20 리뷰 M5, R-12): 자리마다 provider 가 정해져 순서(카카오 → 구글)·중복을 타입이 막는다(리뷰 L4).
 * 상한은 원본 dock.socialGroup.maxItems(3) — apple 자산이 들어오면 세 번째 자리를 연다(N5).
 */
export type SocialGroup = {social: readonly [Social<'kakao'>] | readonly [Social<'kakao'>, Social<'google'>] | readonly [Social<'google'>]};
export const SOCIAL_GROUP_MAX = ds.dock.socialGroupMax;

/** kind 'secondary': 할 일이 끝난 화면의 유일한 버튼이 보조 행동일 때(예: P3 다 마친 뒤 '오늘 코스 다시 보기', 시안 ds4b 3/3) */
export type DockPrimary = (DockAction & {kind?: 'primary' | 'danger' | 'secondary'}) | SocialGroup;
export type DockSecondary = DockAction & {kind?: 'secondary' | 'text'};
/** 한 줄 안내(글) 또는 글자 링크 하나 */
export type DockNote = {text: string; onPress?: never} | {text: string; onPress: () => void};

export type DockProps = {
  primary: DockPrimary;
  secondary?: DockSecondary;
  note?: DockNote;
};

/** 넘침 단계: 0 = 다 Dock, 1 = note 를 본문 끝으로, 2 = note·보조를 본문 끝으로 */
export type DockSpillLevel = 0 | 1 | 2;

export const isSocialGroup = (p: DockPrimary): p is SocialGroup => 'social' in p && Array.isArray(p.social);

function Primary({p}: {p: DockPrimary}) {
  if (isSocialGroup(p)) {
    // 묶음은 자리별 provider(타입). 각 버튼은 minHeight 60, 글자는 자녀 button 역할(상한 1.5)·굵기 500(브랜드 예외)
    return (
      <View style={styles.group} testID="dock-social">
        {p.social.map(s => (
          <SocialButton key={s.provider} {...s} />
        ))}
      </View>
    );
  }
  const {kind = 'primary', ...rest} = p;
  return <Button kind={kind} size="dock" {...rest} />;
}

function Secondary({s}: {s: DockSecondary}) {
  const {kind = 'secondary', ...rest} = s;
  return <Button kind={kind} size="dock" {...rest} />;
}

export function DockNoteView({note}: {note: DockNote}) {
  if (note.onPress) {
    return <Button kind="text" size="dock" label={note.text} onPress={note.onPress} testID="dock-note" />;
  }
  return (
    <Text role="sub" tone="muted" style={styles.noteText} testID="dock-note">
      {note.text}
    </Text>
  );
}

/** Dock 안쪽(Screen 의 하단 고정 영역에 들어간다). onContentHeight 는 넘침 판단용 자연 높이 */
export function Dock({primary, secondary, note, spill = 0, onContentHeight}: DockProps & {spill?: DockSpillLevel; /** h = 잰 높이, rendered = 그때 그린 넘침 단계(PR #83 리뷰 L4) */ onContentHeight?: (h: number, rendered: DockSpillLevel) => void}) {
  return (
    <View
      testID="ds-dock"
      style={styles.dock}
      onLayout={(e: LayoutChangeEvent) => onContentHeight?.(Math.ceil(e.nativeEvent.layout.height), spill)}>
      <Primary p={primary} />
      {secondary && spill < 2 ? <Secondary s={secondary} /> : null}
      {note && spill < 1 ? <DockNoteView note={note} /> : null}
    </View>
  );
}

/** 본문 끝으로 보낸 슬롯(보조 → note 순서, 원래 아래 순서 유지) */
export function DockSpill({secondary, note, spill}: Pick<DockProps, 'secondary' | 'note'> & {spill: DockSpillLevel}) {
  if (spill === 0) {
    return null;
  }
  return (
    <View testID="dock-spill" style={styles.spill}>
      {secondary && spill >= 2 ? <Secondary s={secondary} /> : null}
      {note ? <DockNoteView note={note} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {gap: ds.touch.elder.gap},
  group: {gap: ds.touch.elder.gap},
  spill: {gap: ds.touch.elder.gap, marginTop: ds.space.section},
  noteText: {textAlign: 'center'},
});
