// V1 첫날 순서(UX 깊이 회의, DECISIONS 11-19): N1 알림 안내는 첫 코스 완료(P7 도장) 뒤, 음악 권유는 첫날 제외(bgm.test),
// 첫 P3 덮개는 해님 인사 1개(P8 응원은 첫 단계를 마치고 돌아온 뒤). 링크 경로는 연결 → 동의 → 코스 홈 순서 그대로.
import React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {createPrefs, setPrefsForTest, type Prefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {copy} from '../src/copy/copy';
import {press, pressCourseNext, toHome} from '../testUtils/flow';

jest.setTimeout(20000);
let prefs: Prefs;
beforeEach(() => {
  prefs = createPrefs(memoryStore());
  setPrefsForTest(prefs);
  setLocalStampsForTest(createLocalStamps(memoryStore()));
  setStampFeedbackForTest(() => ({fire: async () => ({sound: false, haptic: false})}));
});
afterEach(() => {
  setPrefsForTest(null);
  setLocalStampsForTest(null);
  setStampFeedbackForTest(null);
  jest.restoreAllMocks();
});

const n1 = () => screen.queryByRole('button', {name: copy.push.permission.yes}); // N1 화면의 '알려 주세요'
const settle = () =>
  act(async () => {
    await new Promise<void>(r => setTimeout(() => r(), 300));
  });

async function home(opts: FakeOptions) {
  const api = createFakeApi({linked: true, consented: true, pushEnabled: false, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'), {timeout: 8000});
  return api;
}

describe('N1 은 첫 코스 완료 뒤', () => {
  test('N1 문구(라이터 2차 PR #46): 제목 "내일 새 사진…", 본문 한 문장', () => {
    expect(copy.push.permission.title).toBe('내일 새 사진이 오면 알려 드릴까요?');
    expect(copy.push.permission.body).toBe('하루 한 번만 알려 드려요');
  });

  test('코스를 마치기 전 코스 홈에서는 N1 이 뜨지 않는다(서버 설정도 묻지 않음)', async () => {
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ['photo']});
    const my = jest.spyOn(api, 'myPushSettings');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('date-line'), {timeout: 8000});
    await settle();
    expect(n1()).toBeNull();
    expect(my).not.toHaveBeenCalled();
  });

  test('마지막 단계 → P7 도장 → 알겠어요 → 코스 홈에서 N1 한 번', async () => {
    const api = await home({completedSteps: ['photo', 'question']});
    const my = jest.spyOn(api, 'myPushSettings');
    await settle();
    expect(n1()).toBeNull();
    expect(my).not.toHaveBeenCalled();
    await pressCourseNext();
    await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
    await press('오늘은 넘어갈게요');
    await waitFor(() => screen.getByTestId('p7-title'));
    expect(n1()).toBeNull(); // P7 위에는 띄우지 않는다
    await press('알겠어요');
    await waitFor(() => expect(n1()).not.toBeNull(), {timeout: 8000});
    expect(screen.getByText(copy.push.permission.title, {exact: false, normalizer: (t: string) => t.replace(/\u2060/g, '').trim()})).toBeTruthy();
    expect(screen.getByText('하루 한 번만 알려 드려요', {normalizer: (t: string) => t.replace(/\u2060/g, '').trim()})).toBeTruthy();
  });

  test('링크 경로: 번호 연결 → 동의 → 코스 홈 순서는 그대로, 코스 전에는 N1 없음', async () => {
    const api = createFakeApi({pushEnabled: false});
    await toHome(api);
    await settle();
    expect(n1()).toBeNull();
  });
});

describe('첫 P3 덮개는 1개(해님 인사), P8 응원은 첫 단계 뒤', () => {
  test('첫 인사가 보이는 동안 응원 대화상자를 띄우지 않고, 첫 단계를 마치고 돌아오면 띄운다', async () => {
    const api = await home({cheers: ['love_you']});
    const get = jest.spyOn(api, 'getMyCheers');
    await waitFor(() => screen.getByTestId('first-greeting'));
    await settle();
    expect(screen.queryByText('가족이 보낸 응원이에요')).toBeNull();
    expect(get).not.toHaveBeenCalled();
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    await press('다 봤어요');
    await waitFor(() => screen.getByTestId('date-line'));
    await waitFor(() => screen.getByText('가족이 보낸 응원이에요'), {timeout: 8000});
    expect(screen.queryByTestId('first-greeting')).toBeNull();
  });

  test('첫 인사를 이미 본 기기는 코스 홈에서 바로 응원을 띄운다(기존 동작)', async () => {
    await prefs.markFirstGreetingSeen();
    await home({cheers: ['love_you']});
    await waitFor(() => screen.getByText('가족이 보낸 응원이에요'), {timeout: 8000});
  });
});
