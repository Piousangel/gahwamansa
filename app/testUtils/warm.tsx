import React from 'react';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';

/**
 * 파일 시작 때 AppRoot 를 한 번 그렸다 내려 콜드 스타트(모듈 첫 로드·첫 렌더, 부하 때 4~6초)를 미리 치른다(PR #101 리뷰).
 * 그러지 않으면 파일의 첫 테스트만 이 비용을 혼자 떠안아 부하 때 대기 시간(asyncUtilTimeout 10초)을 넘겨 흔들린다.
 * 쓰는 법: beforeAll(warmAppRoot, WARM_TIMEOUT_MS). 테스트 본문의 대기 시간은 전역 값 그대로(#77 규칙 — 테스트마다 timeout 을 주지 않는다).
 *
 * WARM_TIMEOUT_MS(DV-1, 2026-11-25): 예열 훅만 따로 길게. 예열이 치르는 것은 첫 렌더 경로의 첫 로드·첫 실행 비용이라
 * 변환 캐시가 없을 때(새 worktree 는 경로가 달라 캐시를 못 쓴다) CPU 경합에 비례해 늘어난다 — 부하 재현(--no-cache 4벌 + 바쁜 루프 16개)에서
 * 전역 hook 제한 20초를 넘겨 'Exceeded timeout of 20000 ms for a hook' 으로 그 파일의 모든 테스트가 실패했다.
 * 기다리는 것이 앱 동작이 아니라 한 번뿐인 적재 비용이므로 그 비용을 받는 자리(예열)만 늘리고, 테스트 본문은 그대로 짧게 둔다.
 *
 * 쓰지 말 것(PR #102 리뷰 L1): 시작 링크(초대 링크)·첫 화면 모션·스플래시·알림으로 열기를 검사하는 파일.
 * 예열 렌더가 시작 링크 처리·첫 실행 상태를 한 번 써 버려, 그 파일의 첫 테스트가 '처음 연 앱'을 보지 못한다.
 */
export const WARM_TIMEOUT_MS = 120000;

export async function warmAppRoot() {
  const r = render(<AppRoot api={createFakeApi()} />);
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'), {timeout: WARM_TIMEOUT_MS - 5000});
  r.unmount();
}
