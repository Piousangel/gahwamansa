// 자녀 화면 v3(C3 대기·C4 홈·응원·C5 지난 답·C7 설정·탭 바): 시안 C3_wait·C4_home(_states)·C5_history·C7_settings_v2, copy-v3 10절
import React from 'react';
import {Share} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import * as clipboard from '../src/ui/clipboard';
import {press} from '../testUtils/flow';

const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const waitApi = (o: Parameters<typeof createFakeApi>[0] = {}) => createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', ...o});
const openWait = async (api: ReturnType<typeof createFakeApi>) => {
  render(<AppRoot api={api} restore />);
  // 파일 첫 렌더는 모듈 첫 로드(사진·SVG)로 느릴 수 있다
  await waitFor(() => screen.getByText('엄마 폰에서 번호를 쓰면 이어져요'), {timeout: 8000});
};
jest.setTimeout(20000);
const openTab = async (name: string) => {
  await waitFor(() => screen.getByRole('tab', {name}));
  await act(async () => {
    fireEvent.press(screen.getByRole('tab', {name}));
  });
};

describe('C3 연결 대기', () => {
  test('번호 카드(번호·만료 시각) → 3단계 → 예시 1장, 만료 전에는 새 번호 만들기가 없다', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'} as never);
    await openWait(waitApi());
    expect(screen.getByText('연결 기다리는 중')).toBeTruthy();
    expect(screen.getByText('123 456')).toBeTruthy();
    expect(screen.getByLabelText('연결 번호 1 2 3, 4 5 6')).toBeTruthy();
    expect(screen.getByText(/까지 쓸 수 있어요$/)).toBeTruthy();
    expect(screen.getByText('엄마 폰에 가화만사성을 설치해요')).toBeTruthy();
    expect(screen.getByText('부모님 휴대폰이에요')).toBeTruthy(); // 부모님 첫 화면의 실제 버튼 글자
    expect(screen.getByText('숫자 6개를 쓰고, 답을 보여 줄지 고르면 돼요')).toBeTruthy();
    expect(within(screen.getByTestId('wait-example')).getByText('예시')).toBeTruthy();
    expect(screen.getByText('AI가 만든 그림')).toBeTruthy();
    expect(screen.queryByRole('button', {name: '새 번호 만들기'})).toBeNull();
    expect(screen.queryByTestId('child-tab-bar')).toBeNull(); // 연결 전 탭 바 숨김
    await press('번호 보내기');
    expect(share).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining('123 456')}));
  });

  test('복사하기 → 복사했어요 토스트', async () => {
    const spy = jest.spyOn(clipboard, 'copyText').mockReturnValue(true);
    await openWait(waitApi());
    await press('복사하기');
    expect(spy).toHaveBeenCalledWith('123456');
    expect(within(screen.getByTestId('toast')).getByText('복사했어요')).toBeTruthy();
  });

  test('번호 기간이 지나면 안내 상자 + 새 번호 만들기, 만들면 토스트와 "전에 보낸 번호" 안내', async () => {
    const api = waitApi({childCodeExpired: true});
    const issue = jest.spyOn(api, 'issueInviteCode');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByText('번호 기간이 지났어요'));
    expect(screen.getByText('새 번호를 만들어 다시 보내 주세요')).toBeTruthy();
    expect(screen.queryByText('연결 기다리는 중')).toBeNull(); // 만료되면 칩·제목을 숨긴다
    await press('새 번호 만들기');
    await waitFor(() => screen.getByText('123 456'));
    expect(issue).toHaveBeenCalledTimes(1);
    expect(screen.getByText('새 번호를 만들었어요')).toBeTruthy();
    expect(screen.getByText('전에 보낸 번호는 이제 쓸 수 없어요')).toBeTruthy();
    expect(screen.getByRole('button', {name: '번호 보내기'})).toBeTruthy();
  });

  test('상단 설정으로 C7 에 갈 수 있다(연결 전: 새 폰 연결 번호 없음)', async () => {
    await openWait(createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', parents: []}));
    await press('설정');
    await waitFor(() => screen.getByText('부르는 이름'));
    expect(screen.queryByText('새 폰 연결 번호')).toBeNull();
    screen.unmount();
  });
});

describe('C4 홈 · 응원', () => {
  test('상단 바·탭 바, 오늘 답이면 "{답} 이야기", 지난 날이면 "이 답으로 이야기를 시작해 봐요"', async () => {
    const {unmount} = render(
      <AppRoot api={createFakeApi({consented: true, parentTitle: '엄마', latest: {prompt: null, choiceLabel: '가을', answeredDate: today}})} role="child" />,
    );
    await waitFor(() => screen.getByText('가을 이야기를 해 볼까요?'));
    expect(screen.getByText('우리 집 앨범')).toBeTruthy();
    expect(screen.getByRole('tab', {name: '앨범', selected: true})).toBeTruthy();
    expect(screen.getByRole('tab', {name: '지난 답'})).toBeTruthy();
    unmount();
    render(<AppRoot api={createFakeApi({consented: true, latest: {prompt: null, choiceLabel: '봄', answeredDate: '2020-01-02'}})} role="child" />);
    await waitFor(() => screen.getByText('이 답으로 이야기를 시작해 봐요'));
  });

  test('응원 보내기: 확정 4개만, 누르면 바로 보내고 "{호칭}께 보냈어요"', async () => {
    const api = createFakeApi({consented: true, parentTitle: '엄마', latest: null});
    const send = jest.spyOn(api, 'sendCheer');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await press('응원 보내기');
    const sheet = screen.getByTestId('sheet');
    expect(within(sheet).getByText('어떤 말을 보낼까요?')).toBeTruthy();
    expect(within(sheet).getByText('하나를 누르면 바로 보내요')).toBeTruthy();
    const options = ['사랑해요, 오늘도 좋은 하루예요', '덕분에 하루가 따뜻해요', '늘 고마워요', '오늘도 편안한 하루 보내세요'];
    for (const o of options) {
      expect(within(sheet).getByRole('button', {name: o})).toBeTruthy();
    }
    expect(within(sheet).queryByText(/건강|전화|듣고 싶어요|천천히/)).toBeNull();
    await press('늘 고마워요');
    expect(send).toHaveBeenCalledWith('parent-1', 'thanks_always');
    await waitFor(() => screen.getByText('엄마께 보냈어요'));
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  test('첫마디 한 줄(B3): 값이 있으면 "이야기 꺼내기" + 문장, 없으면 줄 전체를 숨긴다', async () => {
    const latest = {prompt: null, choiceLabel: '가을', answeredDate: today};
    const {unmount} = render(<AppRoot api={createFakeApi({consented: true, latest, starter: '가을 하면 뭐가 떠오르세요?'})} role="child" />);
    await waitFor(() => screen.getByTestId('child-home-starter'));
    expect(screen.getByText('이야기 꺼내기')).toBeTruthy();
    expect(screen.getByText('가을 하면 뭐가 떠오르세요?')).toBeTruthy();
    unmount();
    render(<AppRoot api={createFakeApi({consented: true, latest})} role="child" />);
    await waitFor(() => screen.getByText('가을 이야기를 해 볼까요?'));
    expect(screen.queryByText('이야기 꺼내기')).toBeNull();
  });

  test('하루 한도를 넘으면 보내지 않고 알린다(서버 daily_limit)', async () => {
    render(<AppRoot api={createFakeApi({consented: true, cheerDailyLimit: 0})} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await press('응원 보내기');
    await press('늘 고마워요');
    await waitFor(() => screen.getByText('잠깐 문제가 생겼어요'));
    expect(screen.queryByText(/께 보냈어요/)).toBeNull();
  });

  test('응원 실패(오프라인)는 토스트로 알린다', async () => {
    render(<AppRoot api={createFakeApi({consented: true, failCheer: 1})} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await press('응원 보내기');
    await press('늘 고마워요');
    await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  });

  test('연결 끊김: 배너 + 최근 답 그대로, 응원 버튼 없음, 번호 만들기 → 그 어르신 재연결 번호', async () => {
    const api = createFakeApi({
      consented: true, parentTitle: '엄마', disconnected: true,
      latest: {prompt: null, choiceLabel: '가을', answeredDate: '2020-11-14'},
    });
    const issue = jest.spyOn(api, 'issueInviteCode');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByText('엄마 폰의 연결이 풀렸어요'));
    expect(screen.getByText('새 번호를 만들어 보내 주세요')).toBeTruthy();
    expect(screen.getByText('가을')).toBeTruthy();
    expect(screen.queryByRole('button', {name: '응원 보내기'})).toBeNull();
    await press('번호 만들기');
    await waitFor(() => screen.getByText('번호가 만들어졌어요'));
    expect(issue).toHaveBeenCalledWith('parent-1');
    expect(screen.getByText('엄마 폰에서 이 번호를 써 주세요')).toBeTruthy();
  });

  test('어르신이 여럿이면 카드마다 호칭, 응원은 연결된 어르신 전부에게', async () => {
    render(
      <AppRoot
        api={createFakeApi({
          parents: [
            {title: '엄마', latest: {prompt: null, choiceLabel: '가을', answeredDate: today}},
            {title: '아빠', latest: null},
          ],
        })}
        role="child"
      />,
    );
    await waitFor(() => screen.getByText('엄마의 최근 답'));
    expect(screen.getByText('아빠의 최근 답')).toBeTruthy();
    await press('응원 보내기');
    await press('늘 고마워요');
    await waitFor(() => screen.getByText('엄마·아빠께 보냈어요'));
  });

  test('서버 오류는 "화면이 열리지 않아요" + 다시 하기', async () => {
    const api = createFakeApi({consented: true});
    jest.spyOn(api, 'fetchChildSummary').mockRejectedValueOnce(new Error('boom'));
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByText('화면이 열리지 않아요'));
    await press('다시 하기');
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
  });
});

describe('C5 지난 답', () => {
  const items = [
    {answeredDate: '2020-11-16', promptShort: '봄과 가을 중', choiceLabel: '가을'},
    {answeredDate: '2020-11-15', promptShort: '라디오와 텔레비전 중', choiceLabel: '라디오'},
  ];

  test('어르신 1명: 제목에 호칭, 최근 한 달 안내, 날짜·짧은 질문·고른 답 행, 이야기 주제 추천', async () => {
    render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마', history: items})} role="child" />);
    await openTab('지난 답');
    await waitFor(() => screen.getByText('엄마의 지난 답'));
    expect(screen.getByText('최근 한 달 동안 고른 답이에요')).toBeTruthy();
    const rows = screen.getAllByTestId('child-past-item');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/2020년 11월 16일.*봄과 가을 중.*가을/);
    expect(rows[1]).toHaveTextContent(/라디오와 텔레비전 중/);
    expect(screen.getByLabelText('2020년 11월 16일, 봄과 가을 중, 고른 답 가을')).toBeTruthy();
    expect(screen.getByTestId('child-past-topic')).toHaveTextContent(/이야기 주제 추천.*곧 유료/);
    expect(screen.queryByText(/개|번째|연속|일째/)).toBeNull(); // 집계 없음
  });

  test('어르신 2명 이상: 제목 "지난 답", 호칭 머리글로 나눈다', async () => {
    render(
      <AppRoot
        api={createFakeApi({
          parents: [
            {title: '엄마', history: [items[0]]},
            {title: '아빠', shared: false},
          ],
        })}
        role="child"
      />,
    );
    await openTab('지난 답');
    await waitFor(() => screen.getByRole('header', {name: '엄마'}));
    expect(screen.getByRole('header', {name: '아빠'})).toBeTruthy();
    expect(screen.getByRole('header', {name: '지난 답'})).toBeTruthy();
    expect(screen.getByText('답을 나누지 않는 중이에요')).toBeTruthy();
  });

  test('나누지 않는 중이면 그 안내만(이야기 주제 행 없음)', async () => {
    render(<AppRoot api={createFakeApi({consented: false})} role="child" />);
    await openTab('지난 답');
    await waitFor(() => screen.getByText('답을 나누지 않는 중이에요'));
    expect(screen.queryByTestId('child-past-topic')).toBeNull();
  });

  test('서버 오류: "목록이 열리지 않아요…" + 다시 하기로 다시 불러온다', async () => {
    render(<AppRoot api={createFakeApi({consented: true, history: items, failHistoryServer: 1})} role="child" />);
    await openTab('지난 답');
    await waitFor(() => screen.getByText('목록이 열리지 않아요. 잠시 뒤에 다시 해 볼까요?'));
    await press('다시 하기');
    await waitFor(() => expect(screen.getAllByTestId('child-past-item')).toHaveLength(2));
  });
});

describe('C7 설정 v2', () => {
  const openSettings = async (api = createFakeApi({consented: true, parentTitle: '엄마'})) => {
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await press('설정');
    await waitFor(() => screen.getByText('부르는 이름'));
    return api;
  };

  test('행: 부르는 이름·새 폰 연결 번호·로그인 수단·로그아웃·내 계정 지우기·앱 정보, 하단 안내', async () => {
    await openSettings();
    expect(screen.getByRole('button', {name: '부르는 이름, 엄마'})).toBeTruthy();
    expect(screen.getByText('엄마 폰을 바꿨을 때 써요')).toBeTruthy();
    await waitFor(() => screen.getByText('카카오로 로그인했어요'));
    expect(screen.getByRole('button', {name: '로그아웃'})).toBeTruthy();
    expect(screen.getByRole('button', {name: '내 계정 지우기'})).toBeTruthy();
    expect(screen.getByText('버전 1.0.0')).toBeTruthy();
    expect(screen.getByText('안부나 안전을 확인하는 서비스가 아니에요')).toBeTruthy();
    expect(screen.queryByText(/알려 드려요/)).toBeNull(); // 알림 행은 숨김(copy 10절)
  });

  test('부르는 이름 시트: 7개 중 고르고 저장 → "부르는 이름을 바꿨어요"', async () => {
    const api = await openSettings();
    const set = jest.spyOn(api, 'setParentTitleFor');
    await press('부르는 이름, 엄마');
    const sheet = screen.getByTestId('sheet');
    expect(within(sheet).getByText('부모님을 어떻게 부르세요?')).toBeTruthy();
    expect(within(sheet).getAllByRole('button').length).toBeGreaterThanOrEqual(8); // 닫기 + 7개
    fireEvent.press(within(sheet).getByText('어머니'));
    await press('저장');
    expect(set).toHaveBeenCalledWith('parent-1', '어머니');
    await waitFor(() => screen.getByText('부르는 이름을 바꿨어요'));
    await waitFor(() => screen.getByRole('button', {name: '부르는 이름, 어머니'}));
  });

  test('새 폰 연결 번호 → 그 어르신 재연결 번호 화면', async () => {
    const api = await openSettings();
    const issue = jest.spyOn(api, 'issueInviteCode');
    await press('새 폰 연결 번호, 엄마 폰을 바꿨을 때 써요');
    await waitFor(() => screen.getByText('번호가 만들어졌어요'));
    expect(issue).toHaveBeenCalledWith('parent-1');
  });

  test('로그아웃: 같은 방법(카카오) 안내 → 그만둘래요는 닫기, 로그아웃은 첫 화면으로', async () => {
    const api = await openSettings(createFakeApi({who: 'child', childFamily: true, childLinked: true, consented: true}));
    const out = jest.spyOn(api, 'signOut');
    await waitFor(() => screen.getByText('카카오로 로그인했어요'));
    await press('로그아웃');
    const dialog = screen.getByTestId('dialog');
    expect(within(dialog).getByText('로그아웃할까요?')).toBeTruthy();
    expect(within(dialog).getByText('같은 방법(카카오)으로 다시 로그인하면 지금 가족과 그대로 이어져요')).toBeTruthy();
    await press('그만둘래요');
    expect(screen.queryByTestId('dialog')).toBeNull();
    await press('로그아웃');
    fireEvent.press(within(screen.getByTestId('dialog')).getByRole('button', {name: '로그아웃'}));
    await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
    expect(out).toHaveBeenCalledTimes(1);
  });

  test('앱 정보: 버전 + AI 고지 상자, 정해지지 않은 행(방침·문의)은 숨긴다', async () => {
    await openSettings();
    await press('앱 정보, 버전 1.0.0');
    await waitFor(() => screen.getByTestId('ai-notice'));
    expect(screen.getByText('AI가 만든 것')).toBeTruthy();
    expect(screen.getByText('앱의 옛날 사진은 AI가 만든 그림이에요. 실제 장소가 아니에요')).toBeTruthy();
    expect(screen.getByText('1.0.0')).toBeTruthy();
    expect(screen.queryByText('[문의 이메일]')).toBeNull();
  });

  test('내 계정 지우기 → 지우기 화면', async () => {
    await openSettings();
    await press('내 계정 지우기');
    await waitFor(() => expect(screen.getAllByText(/되돌릴 수 없어요/).length).toBeGreaterThan(0));
  });
});
