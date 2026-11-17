// 디자인 토큰 v3 (원본: design-system/tokens-v3.json, 값이 어긋나면 __tests__/designSystem.test.tsx 가 실패한다).
// 규칙: 색은 역할 이름으로만 참조하고 화면에서 헥스를 직접 쓰지 않는다.
// 글꼴: tokens-v3 fontCandidate 가 "라이선스 미확인"이라 빌드 1은 시스템 글꼴(fontFamily 미지정)을 쓴다.
//       교체할 때는 font 값만 바꾼다(파일 번들 + 라이선스 확인 후).

const v3 = {
  paper: '#F6F3EE', card: '#FFFFFF', paperSoft: '#EFE9E0', paperEdge: '#E6DCD0',
  ink: '#744821', inkTitle: '#4E2F14', inkSub: '#85592F',
  action: '#744821', actionPressed: '#5A3716', actionSoft: '#EFE0CF', noticeSoft: '#F1E4D4',
  line: '#A67C5A', lineSoft: '#E3D5C5', lineGhost: '#D8C6B0',
  disabledBg: '#ECE8E3', disabledInk: '#6B5C4A', tape: '#EADBC4',
  done: '#166534', doneInk: '#14532D', doneSoft: '#CDEBDD',
  danger: '#B91C1C', dangerInk: '#991B1B', dangerSoft: '#FEE2E2',
  sky: '#CFE6F7', sun: '#FFC93C', sunRay: '#F59E0B', blush: '#FF9E7A',
  accentSun: '#FFE29A', accentPeach: '#FFD6C2', // 첫 화면 소개 아이콘 원(장식)
} as const;

export const color = {
  ...v3,
  onAction: '#FFFFFF', // 주 버튼·위험 칩 위 흰 글자(대비 7.80 / 8.31)
  // v2 이름 호환(기존 호출부용). 새 코드는 오른쪽 역할 이름을 쓴다.
  actionDark: v3.actionPressed,
  actionShadow: v3.actionPressed,
  disabled: v3.disabledBg,
  handwrite: v3.ink,
  placeholder: '#FFF59D', // 개발용 라벨 박스(출시 전 에셋으로 교체)
  scrim: 'rgba(78,47,20,0.58)', // tokens-v3 scrim: 대화상자·시트 뒤 어두운 배경
} as const;

// 외부 브랜드 색(카카오·구글 로그인 버튼 가이드). 우리 토큰이 아니라 각 회사 가이드 값을 그대로 쓴다.
export const brand = {
  kakaoYellow: '#FEE500', kakaoLabel: 'rgba(0,0,0,0.85)', // 카카오 디자인 가이드: 컨테이너 #FEE500, 레이블 #000 85%
  googleSurface: '#FFFFFF', googleBorder: '#747775', googleLabel: '#1F1F1F', // 구글 로그인 버튼(라이트)
} as const;

/** 시스템 글꼴 유지. undefined 면 RN 기본(Android Roboto/Noto CJK, iOS SF/Apple SD Gothic Neo). */
export const font = {title: undefined, body: undefined, hand: undefined} as const;

export const typeScale = {
  elder: {
    display: 36, title: 32, titleSm: 28, bubble: 24, bodyLg: 22, body: 20, hand: 32, handMin: 30,
    hangulGuide: 120, buttonPrimary: 32, buttonSecondary: 26, min: 20,
  },
  child: {childTitle: 30, childBody: 18, childMin: 16, min: 16},
} as const;

// v3 값. 본문 20, 큰 본문 22(시안 P3 v4 토큰 정리: 예전 body 22 이름은 폐기하고 typeScale 과 같은 이름으로)
export const fontSize = {
  display: 36, title: 32, titleSm: 28, bubble: 24, bodyLg: 22, body: 20, hand: 32,
  buttonPrimary: 32, buttonSecondary: 26, childBody: 18, childMin: 16,
} as const;

export const lineHeight = {title: 1.3, bubble: 1.35, bodyElder: 1.5, bodyChild: 1.5, hand: 1.15, button: 1.2} as const;

/** 줄 높이 표(원본 design-system/tokens-v3.json lineHeightTable, 시안 P3 v4 리듬 규칙 D):
 *  20→30, 22→32, 24→34, 28→38, 32→44, 36→48 = 글자 + 10(32 이상은 + 12).
 *  36 초과(자녀 C4 고른 답 72 등)는 max(글자 + 12, 글자 × 1.3) — 줄 높이가 글꼴 기본보다 작으면 Android 가 윗획을 자른다.
 *  여러 줄 글은 이 값, 한 줄 라벨(행 제목·상태·칩)은 labelLineHeight = 글자 + 8. */
export const lineHeightFor = (size: number): number =>
  size > 36 ? Math.max(size + 12, Math.round(size * 1.3)) : size + (size >= 32 ? 12 : 10);
export const labelLineHeight = (size: number): number => size + 8;

/** 글자 확대 상한. 리드 결정(2026-11-17): 본문은 2.0(어르신이 키운 크기를 막지 않음, 본문은 스크롤),
 *  하단 고정 버튼·큰 제목(28 이상)·번호 칸만 1.5(고정 영역이 화면을 덮지 않게). */
export const FONT_SCALE_MAX = 1.5;
export const FONT_SCALE_MAX_BODY = 2;
export const BIG_TITLE_MIN = 28;

export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, screenX: 24, screenXChild: 20, bottom: 28, xxl: 32, topSafeMin: 52,
  // 기존 이름 호환
  s4: 4, s8: 8, s12: 12, s16: 16, s20: 20, s24: 24, s28: 28, s56: 56,
} as const;

export const radius = {chip: 12, childCard: 16, input: 16, card: 22, select: 24, sheet: 28, button: 36, keypadKey: 14, codeCell: 12} as const;

export const touch = {
  elderMin: 64, buttonPrimary: 72, buttonSecondary: 64, codeBox: 68, selectCard: 132, iconButton: 64, link: 64,
  gapMin: 12, childMin: 48, childRecommended: 56, tab: 56, childButton: 56,
} as const;

export const size = {
  buttonPrimary: touch.buttonPrimary, buttonSecondary: touch.buttonSecondary, touchMin: touch.elderMin,
  childTouchMin: touch.childMin, codeBox: touch.codeBox, selectCard: touch.selectCard,
  stepCompact: 60, stepFull: 92, stamp: 44, sunLarge: 88,
} as const;

// 그림자는 장식(정보 전달 안 함). RN 0.76+ boxShadow 사용, 단단한 하단 그림자는 폐기.
export const shadow = {
  soft: '0px 4px 12px rgba(116,72,33,0.18)',
  softPressed: '0px 1px 3px rgba(116,72,33,0.18)',
  lifted: '0px 6px 16px rgba(116,72,33,0.26)',
} as const;

export const layout = {
  bodyPadding: {top: 4, x: 24, bottom: 24, gap: 16},
  dock: {paddingTop: 12, paddingBottomMin: 28, x: 24, maxHeightRatio: 0.4},
} as const;

export const MIN_BODY_FONT = typeScale.elder.min;
export const MIN_TOUCH = touch.elderMin;
