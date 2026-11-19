// 디자인 시스템 v4 역할 → 스타일(SUMMARY 2-1·2-2). 컴포넌트는 숫자·헥스가 아니라 역할·tone 이름만 고르고 값은 생성물(tokensV4)에서 온다.
// 원본 값이 바뀌어도(tokens-v4.json → node scripts/gen-tokens-v4.js) 이 파일과 컴포넌트는 그대로다.
import type {TextStyle} from 'react-native';
import {tokensV4 as t, type Audience, type ColorV4} from '../tokensV4';

export type {Audience};

/** 화면이 고를 수 있는 글자 역할(Text role). button·link·backLink 는 각 컴포넌트 안에서만 쓴다 */
export type TextRole = 'display' | 'title' | 'heading' | 'bodyLg' | 'body' | 'sub' | 'label' | 'numeral' | 'hand';
type InnerRole = TextRole | 'link' | 'backLink' | 'buttonPrimary' | 'buttonSecondary' | 'fieldInput';

/** 글자 tone(뜻). default 는 역할의 기본색, muted 는 보조(어르신 inkSub / 자녀 inkSubChild) */
export type Tone = 'default' | 'muted' | 'accent' | 'info' | 'done' | 'danger' | 'onAction' | 'action' | 'disabled';

const TONE_COLOR: Record<Exclude<Tone, 'default' | 'muted'>, ColorV4> = {
  accent: 'accent',
  info: 'info',
  done: 'doneInk',
  danger: 'dangerInk',
  onAction: 'onAction',
  action: 'action',
  disabled: 'disabledInk',
};

type Spec = {size: number; lineHeight: number; tone: string; icon?: number};

function spec(role: InnerRole, a: Audience): {s: Spec; weight: number; cap: number} {
  if (role === 'buttonPrimary' || role === 'buttonSecondary') {
    const b = t.type.button;
    const k = role === 'buttonPrimary' ? 'primary' : 'secondary';
    return {s: b[a][k] as Spec, weight: b.weight, cap: b.maxFontScale};
  }
  const r = t.type[role];
  return {s: r[a] as Spec, weight: r.weight, cap: r.maxFontScale};
}

export function toneColor(role: InnerRole, tone: Tone, a: Audience): string {
  if (tone === 'default') {
    return t.color[spec(role, a).s.tone as ColorV4];
  }
  if (tone === 'muted') {
    return t.color[(t.type.sub[a] as Spec).tone as ColorV4];
  }
  return t.color[TONE_COLOR[tone]];
}

/** 역할의 글자 스타일 + 확대 상한. 굵기는 400/700 두 단계(빌드 1) */
export function roleText(role: InnerRole, a: Audience, tone: Tone = 'default'): {style: TextStyle; maxFontSizeMultiplier: number; icon?: number} {
  const {s, weight, cap} = spec(role, a);
  return {
    style: {fontSize: s.size, lineHeight: s.lineHeight, fontWeight: weight >= 700 ? '700' : '400', color: toneColor(role, tone, a), letterSpacing: 0},
    maxFontSizeMultiplier: cap,
    icon: s.icon,
  };
}

/** 최소 높이(고정 높이 금지, SUMMARY 2-4). 내용이 늘면 따라 늘어난다 */
export function minTouch(kind: 'primary' | 'secondary' | 'link' | 'choice', a: Audience): number {
  if (a === 'elder') {
    return kind === 'choice' ? t.touch.elder.primary : t.touch.elder[kind];
  }
  return kind === 'primary' || kind === 'choice' ? t.touch.child.primary : t.touch.child.min;
}

export const ds = t;
