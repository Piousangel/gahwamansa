// v3 → v4 대응표(SUMMARY Q11: v3 이름은 한 릴리스 별칭). 손으로 관리, 대상 이름은 __tests__/tokensV4.test.ts 가 tokensV4 에 있는지 검사한다.
// 이행 원칙: tokens.ts(v3)의 이름은 그대로 두고 값은 tokensV4 에서 파생한다(원본 하나). 화면은 시안 v4 뒤 각 레인이 ui/ds 컴포넌트로 옮기며 v3 참조를 지운다.
// 값이 바뀐 이름(inkSub #85592F → #544B43)은 2026-11-20 부터 v3 쪽에도 새 값(어르신 7:1, 접근성 패널 r1). 화면 이행을 기다리지 않는다.
import type {ColorV4, TypeRoleV4} from './tokensV4';

type ColorMove = {v4: readonly ColorV4[]; note: string};

/** v3 color 이름 → v4 에서 써야 할 이름(둘 이상이면 쓰임으로 고른다) */
export const colorV3toV4: Record<string, ColorMove> = {
  ink: {v4: ['inkBody', 'action'], note: '읽는 글은 inkBody(차콜), 누를 수 있는 것은 action. v3 기본 글자색(Text20)이 이 값이었다'},
  handwrite: {v4: ['inkTitle'], note: '손글씨는 hand 역할(tone inkTitle)'},
  inkSub: {v4: ['inkSub', 'inkSubChild'], note: '값 교체(#85592F → #544B43). 자녀 화면은 inkSubChild'},
  actionDark: {v4: ['actionPressed'], note: 'v2 별칭'},
  actionShadow: {v4: ['actionPressed'], note: 'v2 별칭(그림자는 shadow 토큰)'},
  disabled: {v4: ['disabledBg'], note: 'v2 별칭'},
};

type SizeMove = {role: TypeRoleV4; note: string};

/** Text20 size={숫자}(126건) → Text role. 화면을 옮길 때 이 표로 고른다(숫자를 그대로 옮기지 않는다) */
export const text20SizeToRole: Record<number, SizeMove> = {
  20: {role: 'body', note: '설명 문단. 보조·날짜는 sub'},
  22: {role: 'bodyLg', note: '질문 문장·카드 문장·선택지'},
  24: {role: 'heading', note: '[note 필독] 쓰임이 셋: 섹션 제목이면 heading, 뒤로 링크면 BackLink, 말풍선은 bodyLg(700 금지, R-04)'},
  26: {role: 'heading', note: '단계 제목(StepHeader) → heading 또는 Heading level 1(화면 제목이면 title)'},
  28: {role: 'title', note: '화면 제목은 한 화면 1개(Heading level 1)'},
  30: {role: 'title', note: ''},
  32: {role: 'title', note: '손글씨면 hand'},
  40: {role: 'display', note: ''},
  44: {role: 'display', note: ''},
  52: {role: 'display', note: ''},
  72: {role: 'display', note: '자녀 C4 고른 답 등 큰 한 줄'},
};

/** v3 typeScale·fontSize 이름 → v4 역할 */
export const typeScaleV3toV4: Record<string, TypeRoleV4> = {
  display: 'display', title: 'title', titleSm: 'title', bubble: 'bodyLg', bodyLg: 'bodyLg', body: 'body', hand: 'hand',
  buttonPrimary: 'button', buttonSecondary: 'button', childTitle: 'title', childBody: 'bodyLg', childMin: 'sub',
};
