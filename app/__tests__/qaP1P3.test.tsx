import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {CodeInput} from '../src/ui/CodeInput';
import {StepRow} from '../src/ui/StepRow';
import {BigButton} from '../src/ui/BigButton';
import {color} from '../src/ui/tokens';
import {press, toHomeConsented} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

const flat = (el: {props: Record<string, any>}) => {
  const st = typeof el.props.style === 'function' ? (el.props.style as (s: {pressed: boolean}) => unknown)({pressed: false}) : el.props.style;
  return StyleSheet.flatten(st as never) as Record<string, unknown>;
};

// ---- P3
test('P3#1 위 줄: 날짜 + 오른쪽 설정 링크(64 터치), 본문에 큰 설정 버튼 없음', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  const settings = screen.getByRole('button', {name: '설정'});
  expect(flat(settings).minHeight).toBeGreaterThanOrEqual(64);
  expect(within(screen.getByTestId('screen-dock')).getAllByRole('button')).toHaveLength(1); // 주 버튼 하나만
  await press('설정');
  await waitFor(() => screen.getByText('가족에게 답 보여 주기'));
});

test('P3 v4: 스티치는 화면당 1곳(시안 ds4b), P3#9 주 버튼은 지금 단계 이름(시안 copy 10절, QA 11-17)', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  expect(screen.getAllByTestId('stitch', {includeHiddenElements: true})).toHaveLength(1);
  expect(within(screen.getByTestId('screen-dock')).getByRole('button', {name: '사진 보기'})).toBeTruthy();
});

test('P3#6·8 지금 단계 라벨 뒤 테이프, 대기 행은 한 줄(상태 글자 보통 굵기·inkSub)', () => {
  render(
    <>
      <StepRow title="사진 보기" status="now" statusLabel="지금 할 차례" />
      <StepRow title="글씨 쓰기" status="wait" statusLabel="다음 차례" />
    </>,
  );
  expect(screen.getByTestId('step-tape', {includeHiddenElements: true})).toBeTruthy();
  const wait = screen.getByLabelText('글씨 쓰기, 다음 차례');
  expect(flat(wait).flexDirection).toBe('row');
  const label = flat(screen.getByText('다음 차례'));
  expect(label.fontWeight === undefined || label.fontWeight === 'normal' || label.fontWeight === '400').toBe(true);
  expect(label.color).toBe(color.inkSub);
});

// ---- P1
test('P1#5 제목은 "써 주세요"를 붙여 줄바꿈하고 제목색, P1#6 안내는 inkSub', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  const title = await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
  expect(flat(title).color).toBe(color.inkTitle);
  expect(title.props.textBreakStrategy).toBe('balanced');
  expect(flat(screen.getByText('6자리를 다 쓰면 바로 확인해요')).color).toBe(color.inkSub); // v4: 칸 아래 안내
});

test('P1#8 지금 칸은 noticeSoft 면 + 커서 막대, P1#9 키는 흰 면 + 테두리 2(동결 시안 P1_connect_v4) + 최소 64', () => {
  render(<CodeInput value="1" onDigit={() => {}} onDelete={() => {}} onClear={() => {}} />);
  expect(flat(screen.getByTestId('code-cell-1')).backgroundColor).toBe(color.noticeSoft);
  expect(screen.getByTestId('code-cursor')).toBeTruthy();
  const key = flat(screen.getByLabelText('숫자 5'));
  expect(key.backgroundColor).toBe(color.card);
  expect(key.borderWidth).toBe(2);
  expect(key.borderRadius).toBe(6); // v5 반경 4단: keypadKey = row(6)
  expect(key.minHeight as number).toBeGreaterThanOrEqual(64);
});

test('P1#10 "번호가 없어요"를 누르면 도움말이 보인다', async () => {
  // 기준 기기 글자 100%(0단계). jest 모의 기본 글자 배율 2 는 P1 2단계(창 높이를 잰 뒤에 약관·안내를 그림)라 따로 본다(connectFit)
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({width: 411, height: 914, scale: 2.6, fontScale: 1});
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('번호가 없어요');
  await waitFor(() => screen.getByText('번호는 가족이 앱에서 만들어 줘요'));
});

test('P1#12 비활성 "다음": 테두리 없음 + 위에 이유 줄', async () => {
  render(<BigButton label="다음" disabled disabledReason="번호 6개를 모두 써 주세요" onPress={() => {}} />);
  expect(flat(screen.getByRole('button', {name: '다음'})).borderWidth ?? 0).toBe(0);
  const reason = screen.getByText('번호 6개를 모두 써 주세요', {includeHiddenElements: true}); // 화면엔 보이고 화면 읽기는 버튼 힌트로(TalkBack R8)
  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf('번호 6개를 모두 써 주세요')).toBeLessThan(tree.indexOf('"다음"'));
  expect(reason).toBeTruthy();
});

test('P1 v4 번호 화면: "다음" 버튼 없이 칸 묶음이 몇 자리 썼는지 읽힌다(11-2 #12)', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  expect(screen.getByLabelText('연결 번호 6자리 쓰는 칸')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByLabelText('숫자 1')));
  expect(screen.queryByRole('button', {name: '다음'})).toBeNull();
  expect(screen.getByLabelText('연결 번호 6자리, 1자리 썼어요')).toBeTruthy();
});

test('P1#13·P3 하단 영역 위 1dp 실선 없음', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  expect(flat(screen.getByTestId('screen-dock')).borderTopWidth ?? 0).toBe(0);
});

afterEach(() => {
  jest.restoreAllMocks();
});
