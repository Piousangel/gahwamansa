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

const flat = (el: {props: {style: unknown}}) => {
  const st = typeof el.props.style === 'function' ? (el.props.style as (s: {pressed: boolean}) => unknown)({pressed: false}) : el.props.style;
  return StyleSheet.flatten(st as never) as Record<string, unknown>;
};

// ---- P3
test('P3#1 위 줄: 날짜 + 오른쪽 설정 링크(64 터치), 본문에 큰 설정 버튼 없음', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  const settings = screen.getByRole('button', {name: '설정'});
  expect(flat(settings).minHeight).toBeGreaterThanOrEqual(64);
  expect(screen.getAllByTestId('big-button')).toHaveLength(1); // 주 버튼 하나만
  await press('설정');
  await waitFor(() => screen.getByText('가족에게 답 보여 주기'));
});

test('P3#2 스티치 2곳(날짜 아래, 하단 버튼 위), P3#9 주 버튼 "이어서 하기"', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  expect(screen.getAllByTestId('stitch', {includeHiddenElements: true})).toHaveLength(2);
  expect(within(screen.getByTestId('screen-dock')).getByRole('button', {name: '이어서 하기'})).toBeTruthy();
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
  expect(flat(screen.getByText('틀려도 괜찮아요')).color).toBe(color.inkSub);
});

test('P1#8 지금 칸은 noticeSoft 면 + 커서 막대, P1#9 키는 흰 면 + 테두리 3 + 최소 64', () => {
  render(<CodeInput value="1" onDigit={() => {}} onDelete={() => {}} onClear={() => {}} />);
  expect(flat(screen.getByTestId('code-cell-1')).backgroundColor).toBe(color.noticeSoft);
  expect(screen.getByTestId('code-cursor')).toBeTruthy();
  const key = flat(screen.getByLabelText('숫자 5'));
  expect(key.backgroundColor).toBe(color.card);
  expect(key.borderWidth).toBe(3);
  expect(key.minHeight as number).toBeGreaterThanOrEqual(64);
});

test('P1#10 "번호가 없어요"를 누르면 도움말이 보인다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('번호가 없어요');
  await waitFor(() => screen.getByText('번호는 가족이 앱에서 만들어 줘요'));
});

test('P1#12 비활성 "다음": 테두리 없음 + 위에 이유 줄', async () => {
  render(<BigButton label="다음" disabled disabledReason="번호 6개를 모두 써 주세요" onPress={() => {}} />);
  expect(flat(screen.getByRole('button', {name: '다음'})).borderWidth ?? 0).toBe(0);
  const reason = screen.getByText('번호 6개를 모두 써 주세요');
  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf('번호 6개를 모두 써 주세요')).toBeLessThan(tree.indexOf('"다음"'));
  expect(reason).toBeTruthy();
});

test('P1#12 번호 화면: 6칸 미만이면 다음이 비활성이고 이유 줄', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByText('번호 6개를 모두 써 주세요'));
  await act(async () => fireEvent.press(screen.getByLabelText('숫자 1')));
  expect(screen.getByRole('button', {name: '다음'})).toBeDisabled();
});

test('P1#13·P3 하단 영역 위 1dp 실선 없음', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  expect(flat(screen.getByTestId('screen-dock')).borderTopWidth ?? 0).toBe(0);
});
