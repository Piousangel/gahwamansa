// Dock 넘침 판단(순수 함수). 실제 높이는 Screen 이 onLayout 으로 재고, 테스트·예산 검사는 아래 추정을 쓴다.
// 추정의 한계: 글꼴 실측이 아니라 글자 폭 근사(한글 1em, 그 밖 0.55em, 띄어쓰기 0.3em)라 실기기 캡처(Maestro)를 대신하지 못한다.
import {ds, minTouch, roleText, type Audience} from './roles';
import {isSocialGroup, type DockProps, type DockSpillLevel} from './Dock';
import {SOCIAL_MIN_HEIGHT} from './SocialButton';

/** Dock 상한(dp). variant intro 는 예외 비율을 쓴다(Screen) */
export const dockCap = (windowHeight: number, ratio: number = ds.dock.maxHeightRatio) => Math.floor(windowHeight * ratio);

/** 잰 높이가 상한을 넘으면 다음 넘침 단계. 2단계에서도 넘치면 2 그대로(최후 수단: 페이드 + 테스트 실패) */
export function nextSpill(level: DockSpillLevel, measured: number, cap: number, has: {secondary: boolean; note: boolean}): DockSpillLevel {
  if (measured <= cap) {
    return level;
  }
  if (level === 0) {
    return has.note ? 1 : has.secondary ? 2 : 0;
  }
  if (level === 1) {
    return has.secondary ? 2 : 1;
  }
  return 2;
}

const charW = (ch: string) => (/[가-힣ㄱ-ㆎ]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.55);

/** 어절 단위 줄바꿈(keep-all) 줄 수 추정. 한 어절이 한 줄보다 길면 글자 단위로 끊는다 */
export function estimateLines(text: string, fontPx: number, width: number): number {
  let lines = 1;
  let x = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = [...word].reduce((s, ch) => s + charW(ch) * fontPx, 0);
    const lead = x === 0 ? 0 : 0.3 * fontPx;
    if (x + lead + w <= width) {
      x += lead + w;
      continue;
    }
    if (x > 0) {
      lines += 1;
    }
    if (w <= width) {
      x = w;
    } else {
      const extra = Math.ceil(w / width) - 1;
      lines += extra;
      x = w - extra * width;
    }
  }
  return lines;
}

type Env = {width: number; fontScale: number; audience: Audience};

function textBlock(role: Parameters<typeof roleText>[0], text: string, width: number, env: Env) {
  const r = roleText(role, env.audience);
  const s = Math.min(env.fontScale, r.maxFontSizeMultiplier);
  const lines = estimateLines(text, (r.style.fontSize as number) * s, width);
  return lines * (r.style.lineHeight as number) * s;
}

/** 슬롯별 추정 높이(dp) */
export function estimateDock(props: DockProps, env: Env, spill: DockSpillLevel = 0) {
  const gap = ds.touch.elder.gap;
  const inner = env.width - 2 * ds.dock.padding.x;
  const btn = (role: 'buttonPrimary' | 'buttonSecondary' | 'link', label: string, min: number, reason?: string) =>
    Math.max(min, textBlock(role, label, inner - 40, env) + 16) + (reason ? textBlock('sub', reason, inner, env) + 8 : 0);
  const parts: number[] = [];
  const p = props.primary;
  if (isSocialGroup(p)) {
    // 같은 높이(dock.socialGroup equalSize): 가장 긴 레이블 기준
    const one = Math.max(...p.social.map(x => Math.max(SOCIAL_MIN_HEIGHT, textBlock('buttonPrimary', x.label, inner - 80, {...env, audience: 'child'}) + 16)));
    const each = p.social.map(() => one);
    parts.push(each.reduce((a, b) => a + b, 0) + gap * (each.length - 1));
  } else {
    parts.push(btn(p.kind === 'danger' ? 'buttonSecondary' : 'buttonPrimary', p.label, minTouch(p.kind === 'danger' ? 'secondary' : 'primary', env.audience), p.disabled ? p.disabledReason : undefined));
  }
  if (props.secondary && spill < 2) {
    const k = props.secondary.kind === 'text';
    parts.push(btn(k ? 'link' : 'buttonSecondary', props.secondary.label, minTouch(k ? 'link' : 'secondary', env.audience)));
  }
  if (props.note && spill < 1) {
    parts.push(
      props.note.onPress ? btn('link', props.note.text, minTouch('link', env.audience)) : textBlock('sub', props.note.text, inner, env),
    );
  }
  const content = parts.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
  return {content, total: content + ds.dock.padding.top + ds.dock.padding.bottomMin, parts};
}

/** 상한 안에 들어갈 때까지 note → 보조를 본문으로 보낸 결과. fits=false 면 최후 수단(페이드)까지 간 것 = 테스트 실패 대상 */
export function planDock(props: DockProps, env: Env & {height: number}, ratio?: number) {
  const cap = dockCap(env.height, ratio);
  const has = {secondary: !!props.secondary, note: !!props.note};
  let spill: DockSpillLevel = 0;
  for (;;) {
    const total = estimateDock(props, env, spill).total;
    const next = nextSpill(spill, total, cap, has);
    if (next === spill) {
      return {spill, total, cap, fits: total <= cap};
    }
    spill = next;
  }
}
