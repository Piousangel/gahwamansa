// ui/ds 레이아웃 테스트 — 320×640 · 글자 200%(SUMMARY 3절 RNTL 5). 실제 줄바꿈·잘림·자판 높이는 jest 가 재지 못한다(한계, Maestro·실기기 몫).
// 여기서 지키는 것: 글자를 담는 상자에 고정 height·maxHeight 없음, 말줄임 없음(예외 prop 제외), 모든 글자에 역할 상한,
// DsScreen 의 자판 열림 접기, Dock 넘침 → note·보조를 본문 끝으로, '더 있음' 띠(R-19)는 넘칠 때만·스크롤 영역 밖.
import React from 'react';
import {Keyboard, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, within} from '@testing-library/react-native';
import {AudienceProvider, BackLink, Banner, Button, Card, Choice, DsScreen, Field, Heading, Section, SocialButton, StateView, Text, type DockProps} from '../src/ui/ds';
import {INTRO_DOCK_RATIO, dockRatioFor} from '../src/ui/ds/Screen';
import {dockCap, estimateLines, nextSpill, planDock} from '../src/ui/ds/dockLayout';
import {MORE_BAND_H} from '../src/ui/ds/MoreBand';

const W = 320;
const H = 640;
let mockFontScale = 2;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 320, height: 640, scale: 2, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 2;
  jest.restoreAllMocks();
});

const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;
const noop = () => {};
const H_ALL = {includeHiddenElements: true};

type Node = {type: string; props: Record<string, unknown>; children: (Node | string)[] | null};
function walk(n: Node | Node[] | null, visit: (n: Node) => void) {
  if (!n) {
    return;
  }
  for (const x of Array.isArray(n) ? n : [n]) {
    visit(x);
    for (const ch of x.children ?? []) {
      if (typeof ch !== 'string') {
        walk(ch, visit);
      }
    }
  }
}

function Everything({audience}: {audience: 'elder' | 'child'}) {
  return (
    <AudienceProvider value={audience}>
      <BackLink label="오늘 코스로" onPress={noop} />
      <Heading level={1}>아주 긴 화면 제목이 두 줄 세 줄로 넘어가도 괜찮아요</Heading>
      <Section title="섹션 제목">
        <Card>
          <Text role="bodyLg">카드 안 질문 문장이 길어서 여러 줄로 내려가요</Text>
          <Text role="sub">보조 설명</Text>
        </Card>
      </Section>
      <Choice mode="radio" value="a" onSelect={noop} items={[{key: 'a', label: '첫째 선택지는 두 줄까지 늘어날 수 있어요', icon: 'icon-photo'}, {key: 'b', label: '둘째', hint: '설명'}]} />
      <Field label="이름" hint="예: 김영희" value="" onChangeText={noop} />
      <Banner tone="info" text="안내 띠 글자" action={{label: '닫기', onPress: noop}} />
      <StateView kind="empty" title="아직 없어요" body="사진을 하나 올려 볼까요" action={{label: '사진 고르기', onPress: noop}} />
      <Button label="다 썼어요 그리고 더 긴 버튼 글" onPress={noop} />
      <Button kind="secondary" label="다시 쓰기" onPress={noop} disabled disabledReason="한 글자 이상 써 주세요" />
      <SocialButton provider="kakao" label="카카오 로그인" onPress={noop} />
    </AudienceProvider>
  );
}

describe.each(['elder', 'child'] as const)('320×640·200%% (%s)', audience => {
  test('글자를 담는 상자에 고정 height·maxHeight 가 없다(minHeight 만)', () => {
    const {toJSON} = render(<Everything audience={audience} />);
    const fixed: string[] = [];
    walk(toJSON() as Node, n => {
      if (n.type === 'RNSVGSvgView' || n.type === 'Image' || String(n.type).startsWith('RNSVG')) {
        return; // 아이콘·로고는 글자가 아님
      }
      const st = flat(n.props.style);
      if (st.height !== undefined || st.maxHeight !== undefined) {
        fixed.push(`${n.type}:${String(n.props.testID)}`);
      }
    });
    expect(fixed).toEqual([]);
  });
  test('모든 글자: 말줄임 없음, 역할 상한(1.5 또는 2.0)이 붙어 있다', () => {
    const {toJSON} = render(<Everything audience={audience} />);
    const bad: string[] = [];
    let texts = 0;
    walk(toJSON() as Node, n => {
      if (n.type !== 'Text' && n.type !== 'TextInput') {
        return;
      }
      texts += 1;
      const cap = n.props.maxFontSizeMultiplier;
      if (n.props.numberOfLines !== undefined || !(cap === 1.5 || cap === 2)) {
        bad.push(`${n.type} numberOfLines=${String(n.props.numberOfLines)} cap=${String(cap)}`);
      }
    });
    expect(texts).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });
});

describe('DsScreen', () => {
  const dock: DockProps = {primary: {label: '다 썼어요', onPress: noop}, secondary: {label: '다시 쓰기', onPress: noop}, note: {text: '천천히 해도 돼요'}};

  test('step: 자판이 열리면 위 영역을 BackLink 한 줄로 접고 단계 정보는 힌트로, 닫히면 돌아온다', () => {
    const handlers: Record<string, () => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, fn: () => void) => {
      handlers[ev] = fn;
      return {remove: noop};
    }) as never);
    render(
      <DsScreen variant="step" back={{label: '오늘 코스로', onPress: noop}} header={<Heading level={1}>이름 쓰기</Heading>} stepInfo="3단계 중 2단계, 이름 쓰기">
        <Field label="이름" value="" onChangeText={noop} />
      </DsScreen>,
    );
    expect(screen.getByText('이름 쓰기')).toBeTruthy();
    act(() => handlers.keyboardDidShow());
    expect(screen.queryByText('이름 쓰기')).toBeNull();
    expect(screen.getByTestId('back-link').props.accessibilityHint).toBe('3단계 중 2단계, 이름 쓰기');
    act(() => handlers.keyboardDidHide());
    expect(screen.getByText('이름 쓰기')).toBeTruthy();
  });

  test('intro 는 자판이 열려도 위 영역을 접지 않는다', () => {
    const handlers: Record<string, (() => void)[]> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, fn: () => void) => {
      (handlers[ev] ??= []).push(fn);
      return {remove: noop};
    }) as never);
    render(
      <DsScreen variant="intro" header={<Heading level={1}>가화만사성</Heading>} dock={{primary: {label: '시작하기', onPress: noop}}}>
        <Text role="body">소개</Text>
      </DsScreen>,
    );
    act(() => (handlers.keyboardDidShow ?? []).forEach(f => f()));
    expect(screen.getByText('가화만사성')).toBeTruthy();
  });

  test('tail 은 Dock 에서 넘친 슬롯보다 아래, 본문 맨 끝(C0 v4 출구)', () => {
    render(
      <DsScreen variant="form" dock={dock} tail={<Text role="sub" testID="tail">출구</Text>}>
        <Text role="body">본문</Text>
      </DsScreen>,
    );
    act(() => fireEvent(screen.getByTestId('ds-dock'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: W, height: 300}}}));
    // 문서 순서(앞에서부터 찾은 차례)로 비교
    const order = screen.root.findAll(n => typeof n.type === 'string' && (n.props.testID === 'dock-spill' || n.props.testID === 'tail')).map(n => n.props.testID);
    expect(order).toEqual(['dock-spill', 'tail']);
  });

  test('Dock 이 상한(640×40%=256)을 넘으면 note → 보조 순으로 본문 끝으로 보낸다', () => {
    render(
      <DsScreen variant="form" dock={dock}>
        <Text role="body">본문</Text>
      </DsScreen>,
    );
    const cap = dockCap(H);
    expect(cap).toBe(256);
    const layout = (h: number) => act(() => fireEvent(screen.getByTestId('ds-dock'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: W, height: h}}}));
    expect(within(screen.getByTestId('ds-dock')).getByTestId('dock-note')).toBeTruthy();
    layout(300);
    expect(within(screen.getByTestId('dock-spill')).getByTestId('dock-note')).toBeTruthy();
    expect(within(screen.getByTestId('ds-dock')).queryByTestId('dock-note')).toBeNull();
    expect(within(screen.getByTestId('ds-dock')).getByText('다시 쓰기')).toBeTruthy();
    layout(280);
    expect(within(screen.getByTestId('dock-spill')).getByText('다시 쓰기')).toBeTruthy();
    expect(within(screen.getByTestId('ds-dock')).queryByText('다시 쓰기')).toBeNull();
    // 주 버튼은 언제나 Dock 에 남는다(한 화면 한 목적)
    expect(within(screen.getByTestId('ds-dock')).getByText('다 썼어요')).toBeTruthy();
  });

  test('자판이 열리면 상한은 보이는 창(창 - 자판) 기준(R-15, 리뷰 M3)', () => {
    const handlers: Record<string, ((e?: unknown) => void)[]> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, fn: (e?: unknown) => void) => {
      (handlers[ev] ??= []).push(fn);
      return {remove: noop};
    }) as never);
    render(
      <DsScreen variant="form" dock={dock}>
        <Text role="body">본문</Text>
      </DsScreen>,
    );
    const layout = (h: number) => act(() => fireEvent(screen.getByTestId('ds-dock'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: W, height: h}}}));
    layout(150); // 자판 닫힘: 150 + 여백 34 < 256 → 그대로
    expect(screen.queryByTestId('dock-spill')).toBeNull();
    act(() => (handlers.keyboardDidShow ?? []).forEach(f => f({endCoordinates: {height: 280}})));
    // 보이는 창 360 × 0.4 = 144 → 같은 Dock 이 넘친다 → note 를 본문으로
    layout(150);
    expect(within(screen.getByTestId('dock-spill')).getByTestId('dock-note')).toBeTruthy();
    expect(flat(screen.getByTestId('screen-dock').props.style).maxHeight).toBe(dockCap(H - 280));
    act(() => (handlers.keyboardDidHide ?? []).forEach(f => f()));
    expect(screen.queryByTestId('dock-spill')).toBeNull(); // 닫히면 다시 Dock 에 다 넣고 잰다
  });

  test('R-12 예외(PR #74): 자판이 열린 채 주 버튼만으로도 상한을 넘으면 Dock 을 풀고 주 버튼을 본문(children 뒤·tail 앞)에, 닫히면 다시 Dock', () => {
    const handlers: Record<string, ((e?: unknown) => void)[]> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, fn: (e?: unknown) => void) => {
      (handlers[ev] ??= []).push(fn);
      return {remove: noop};
    }) as never);
    const press = jest.fn();
    render(
      <DsScreen variant="form" dock={{primary: {label: '인증번호 받기', onPress: press}}} tail={<Text role="sub" testID="tail">약관</Text>}>
        <Text role="body" testID="field">칸</Text>
      </DsScreen>,
    );
    const layout = (h: number) => act(() => fireEvent(screen.getByTestId('ds-dock'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: W, height: h}}}));
    act(() => (handlers.keyboardDidShow ?? []).forEach(f => f({endCoordinates: {height: 260}})));
    layout(180); // 보이는 창 380 × 0.4 = 152 < 180 + 여백 → 보낼 슬롯이 없다
    expect(screen.queryByTestId('screen-dock')).toBeNull();
    const order = screen.root.findAll(n => typeof n.type === 'string' && ['field', 'dock-undocked', 'tail'].includes(n.props.testID)).map(n => n.props.testID);
    expect(order).toEqual(['field', 'dock-undocked', 'tail']);
    fireEvent.press(within(screen.getByTestId('dock-undocked')).getByRole('button', {name: '인증번호 받기'}));
    expect(press).toHaveBeenCalled();
    act(() => (handlers.keyboardDidHide ?? []).forEach(f => f()));
    expect(screen.getByTestId('screen-dock')).toBeTruthy();
    expect(screen.queryByTestId('dock-undocked')).toBeNull();
  });

  test('SocialGroup 이 든 Dock 은 intro 라도 0.4(R-12, 리뷰 M4)', () => {
    const social: DockProps = {primary: {social: [{provider: 'kakao', label: '카카오 로그인', onPress: noop}]}};
    expect(dockRatioFor('intro', social)).toBe(0.4);
    expect(dockRatioFor('intro', {primary: {label: '시작하기', onPress: noop}})).toBe(INTRO_DOCK_RATIO);
    render(
      <DsScreen variant="intro" dock={social}>
        <Text role="body">소개</Text>
      </DsScreen>,
    );
    expect(flat(screen.getByTestId('screen-dock').props.style).maxHeight).toBe(dockCap(H));
  });

  test('상한 안이면 Dock 그대로(본문으로 보내지 않음)', () => {
    render(
      <DsScreen variant="form" dock={dock}>
        <Text role="body">본문</Text>
      </DsScreen>,
    );
    act(() => fireEvent(screen.getByTestId('ds-dock'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: W, height: 150}}}));
    expect(screen.queryByTestId('dock-spill')).toBeNull();
  });

  test("'더 있음' 띠(R-19): 넘칠 때만, 스크롤 영역 밖에, 높이 24, 화면 읽기 제외", () => {
    render(
      <DsScreen variant="form" dock={{primary: {label: '다 썼어요', onPress: noop}}}>
        <Text role="body">본문</Text>
      </DsScreen>,
    );
    const body = screen.getByTestId('screen-body');
    expect(screen.queryByTestId('more-band', H_ALL)).toBeNull();
    act(() => {
      fireEvent(body, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: W, height: 300}}});
      fireEvent(body, 'contentSizeChange', W, 900);
    });
    const band = screen.getByTestId('more-band', H_ALL);
    expect(flat(band.props.style).height).toBe(MORE_BAND_H);
    expect(within(body).queryByTestId('more-band', H_ALL)).toBeNull(); // 스크롤 영역 밖
    expect(screen.queryByTestId('screen-more', H_ALL)).toBeNull(); // 글자 위 페이드 없음
    // 끝까지 내리면 사라진다
    act(() => fireEvent.scroll(body, {nativeEvent: {contentOffset: {y: 600}, contentSize: {height: 900}, layoutMeasurement: {height: 300}}}));
    expect(screen.queryByTestId('more-band', H_ALL)).toBeNull();
  });
});

describe('dockLayout(추정)', () => {
  test('keep-all 줄 수: 어절 단위로 넘김', () => {
    expect(estimateLines('다 썼어요', 30, 1000)).toBe(1);
    expect(estimateLines('오늘 코스로 돌아가기', 44, 232)).toBeGreaterThan(1);
  });
  test('nextSpill: note → 보조 → 그대로(최후 수단)', () => {
    const has = {secondary: true, note: true};
    expect(nextSpill(0, 300, 256, has)).toBe(1);
    expect(nextSpill(1, 300, 256, has)).toBe(2);
    expect(nextSpill(2, 300, 256, has)).toBe(2);
    expect(nextSpill(0, 200, 256, has)).toBe(0);
    expect(nextSpill(0, 300, 256, {secondary: true, note: false})).toBe(2);
  });
  test('intro 상한은 예외 비율', () => {
    expect(dockCap(H, INTRO_DOCK_RATIO)).toBe(384);
  });
  test('planDock: 320×640·200% 에서 과적한 Dock 은 note·보조를 보내도 넘치면 fits=false', () => {
    const env = {width: W, height: H, fontScale: 2, audience: 'elder' as const};
    const ok = planDock({primary: {label: '다 썼어요', onPress: noop}, note: {text: '천천히 해도 돼요'}}, env);
    expect(ok.fits).toBe(true);
    const over = planDock({primary: {label: '아주 아주 긴 주 버튼 문구가 여러 줄로 넘어가서 상한을 넘어요 정말로 길어요', onPress: noop, disabled: true, disabledReason: '이유도 아주 길게 여러 줄로 써 두었어요 그래서 더 커져요'}, secondary: {label: '보조', onPress: noop}}, env);
    expect(over.spill).toBe(2);
    expect(over.fits).toBe(false);
  });
});
