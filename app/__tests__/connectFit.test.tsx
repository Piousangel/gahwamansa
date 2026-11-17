import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {keypadKeyHeight} from '../src/features/link/keypadFit';
import {press} from '../testUtils/flow';

test('계산: 6칸 + 키 4줄 = 키 높이 5개 + 간격 48', () => {
  expect(keypadKeyHeight(5 * 68 + 48)).toBe(68);
  expect(keypadKeyHeight(5 * 66 + 48)).toBe(66);
  expect(keypadKeyHeight(5 * 64 + 48)).toBe(64);
  expect(keypadKeyHeight(5 * 60 + 48)).toBeNull(); // 64 미만이면 null(보조 문구를 숨겨 공간 확보)
});

async function openConnect() {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
}
const layout = async (h: number) =>
  act(async () => {
    fireEvent(screen.getByTestId('keypad-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 328, height: h}}});
  });

test('어르신 번호 화면: 본문 스크롤 없이 6칸·키 4줄이 남은 높이에 맞춰진다', async () => {
  await openConnect();
  expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(false);
  await layout(5 * 66 + 48);
  const key = screen.getByLabelText('숫자 0');
  const st = typeof key.props.style === 'function' ? key.props.style({pressed: false}) : key.props.style;
  const flat = Array.isArray(st) ? Object.assign({}, ...st.filter(Boolean)) : st;
  expect(flat.minHeight).toBe(66);
  expect(flat.minHeight).toBeGreaterThanOrEqual(64);
  for (const d of '0123456789') {
    expect(screen.getByLabelText(`숫자 ${d}`)).toBeTruthy();
  }
});

test('작은 화면: 보조 문구를 먼저 숨긴다(키는 64 유지)', async () => {
  await openConnect();
  expect(screen.getByText('틀려도 괜찮아요')).toBeTruthy();
  await layout(5 * 60 + 48);
  expect(screen.queryByText('틀려도 괜찮아요')).toBeNull();
});
