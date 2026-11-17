// 한국어 줄바꿈: CSS word-break: keep-all 의 RN 대응.
// - iOS: Text 의 lineBreakStrategyIOS="hangul-word"(NSLineBreakStrategyHangulWordPriority)로 어절 단위 줄바꿈.
// - Android: RN 0.88 코어에는 LineBreakConfig(lineBreakWordStyle=phrase, API 33+) 연결 prop 이 없다
//   (node_modules/react-native/ReactAndroid 에 LineBreakConfig 사용 0건 확인). 그래서 어절 안 글자 사이에
//   한글 음절 사이에 U+2060 WORD JOINER(UAX#14 WJ, 앞뒤 줄바꿈 금지)를 넣어 띄어쓰기에서만 줄이 바뀌게 한다.
//   화면 읽기에는 원문을 accessibilityLabel 로 준다(Text20). E2E 는 accessibilityLabel·testID 로 찾는다.
//   한 어절이 한 줄보다 길면 Android 가 강제로 끊는다(overflow-wrap: break-word 와 같은 결과).
import {Platform} from 'react-native';
import type {ReactNode} from 'react';

export const WORD_JOINER = '⁠';

const HANGUL_PAIR = /([\uAC00-\uD7A3])(?=[\uAC00-\uD7A3])/g;

/**
 * NFC 로 합친 뒤 "인접한 한글 음절" 사이에만 WJ 를 넣는다.
 * - 조합형(NFD) 자모 사이에 넣으면 낱자로 풀려 보이므로 먼저 합친다.
 * - 이모지 묶음·국기·영문·숫자는 건드리지 않는다(UAX#14 가 원래 그 안에서 끊지 않음).
 * - 이미 WJ 가 있는 자리는 더 이상 "인접"이 아니라 다시 넣지 않는다(멱등).
 */
export function keepAll(text: string): string {
  return text.normalize('NFC').replace(HANGUL_PAIR, `$1${WORD_JOINER}`);
}

/** Text children 중 문자열만 Android 에서 keepAll 처리한다(iOS 는 lineBreakStrategyIOS 로 충분). */
export function keepAllChildren(children: ReactNode, os: string = Platform.OS): ReactNode {
  if (os !== 'android') {
    return children;
  }
  if (typeof children === 'string') {
    return keepAll(children);
  }
  if (Array.isArray(children)) {
    return children.map(c => (typeof c === 'string' ? keepAll(c) : c));
  }
  return children;
}

/** 모든 어르신 글자에 붙이는 공통 Text props. */
export const koreanTextProps = {
  lineBreakStrategyIOS: 'hangul-word' as const,
  textBreakStrategy: 'highQuality' as const,
};
