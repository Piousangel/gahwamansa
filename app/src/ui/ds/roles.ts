// 디자인 시스템 v4 역할 → 스타일(SUMMARY 2-1·2-2). 컴포넌트는 숫자·헥스가 아니라 역할·tone 이름만 고르고 값은 생성물(tokensV4)에서 온다.
// 원본 값이 바뀌어도(tokens-v4.json → node scripts/gen-tokens-v4.js) 이 파일과 컴포넌트는 그대로다.
import {Platform, type TextStyle} from 'react-native';
import {tokensV4 as t, type Audience, type ColorV4} from '../tokensV4';

export type {Audience};

/** 화면이 고를 수 있는 글자 역할(Text role). button·link·backLink 는 각 컴포넌트 안에서만 쓴다 */
export type TextRole = 'display' | 'title' | 'heading' | 'bodyLg' | 'body' | 'sub' | 'label' | 'numeral' | 'hand' | 'answer' | 'answerRow';
type InnerRole = TextRole | 'link' | 'backLink' | 'buttonPrimary' | 'buttonSecondary' | 'fieldInput';

/** 글자 tone(뜻). default 는 역할의 기본색, muted 는 보조(어르신 inkSub / 자녀 inkSubChild) */
export type Tone = 'default' | 'muted' | 'accent' | 'info' | 'done' | 'danger' | 'onAction' | 'action' | 'actionPressed' | 'disabled';
/** 화면이 Text 에 고를 수 있는 tone(PR #29 리뷰 M1). 나머지는 컴포넌트 내부 전용 */
export type TextTone = Extract<Tone, 'default' | 'muted' | 'accent' | 'done' | 'danger'>;

const TONE_COLOR: Record<Exclude<Tone, 'default' | 'muted'>, ColorV4> = {
  accent: 'accent',
  info: 'info',
  done: 'doneInk',
  danger: 'dangerInk',
  onAction: 'onAction',
  action: 'action',
  actionPressed: 'actionPressed', // 보조·text 버튼 눌림 글자(tokens-v4 states.pressed, actionSoft 위 8.15)
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
  // answer·answerRow 는 자녀 전용(디자인 #103 R-21). 어르신 값이 없으니 자녀 값을 쓴다(어르신 화면에서 쓰지 않음 — 테스트가 지킨다)
  const s = (a in r ? (r as Record<Audience, Spec>)[a] : (r as {child: Spec}).child) as Spec;
  return {s, weight: r.weight, cap: r.maxFontScale};
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

type FaceKey = 'body' | 'hand';
type FontSet = {bundled: {android: boolean; ios: boolean}; body: {family: string; android: string; faces: Record<string, string>; numerals?: string}; hand: {family: string; android: string; faces: Record<string, string>}};

/**
 * 글꼴(F-01): 번들됐으면 역할의 글꼴을 고른다.
 * - Android: res/font 의 XML 글꼴 묶음 이름(굵기별 파일을 fontWeight 로 고른다 — MainApplication 이 ReactFontManager 에 등록). 가짜 굵게가 겹치지 않는다
 * - iOS: 굵기별 PostScript 이름
 * - 그 플랫폼에 번들 전(bundled.android/ios=false)이면 아무것도 넣지 않는다(시스템 글꼴). iOS 는 빌드 2 에서 켠다(#159 M1)
 * 숫자는 tabular(body.numerals) — 번호·날짜 자릿수가 흔들리지 않게
 */
export function fontStyle(face: FaceKey, weight: 400 | 700, os: string = Platform.OS, font: FontSet = t.font as unknown as FontSet): TextStyle {
  if (!(os === 'android' ? font.bundled.android : os === 'ios' ? font.bundled.ios : false)) {
    return {};
  }
  const f = font[face];
  const family = os === 'android' ? f.android : f.faces[String(weight)] ?? f.faces['400'];
  const numerals = face === 'body' && font.body.numerals ? {fontVariant: [font.body.numerals as 'tabular-nums']} : {};
  return {fontFamily: family, ...numerals};
}

const roleFace = (role: InnerRole): FaceKey => {
  const key = role === 'buttonPrimary' || role === 'buttonSecondary' ? 'button' : role;
  return ((t.font.roleFace as Record<string, string>)[key] ?? 'body') as FaceKey;
};

/** 역할의 글자 스타일 + 확대 상한. 굵기는 400/700 두 단계(빌드 1) */
export function roleText(role: InnerRole, a: Audience, tone: Tone = 'default'): {style: TextStyle; maxFontSizeMultiplier: number; icon?: number} {
  const {s, weight, cap} = spec(role, a);
  const w = weight >= 700 ? 700 : 400;
  return {
    style: {fontSize: s.size, lineHeight: s.lineHeight, fontWeight: w === 700 ? '700' : '400', color: toneColor(role, tone, a), letterSpacing: 0, ...fontStyle(roleFace(role), w)},
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
