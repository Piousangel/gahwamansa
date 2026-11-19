import React from 'react';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';

/**
 * 파일 시작 때 AppRoot 를 한 번 그렸다 내려 콜드 스타트(모듈 첫 로드·첫 렌더, 부하 때 4~6초)를 미리 치른다(PR #101 리뷰).
 * 그러지 않으면 파일의 첫 테스트만 이 비용을 혼자 떠안아 부하 때 대기 시간(asyncUtilTimeout 10초)을 넘겨 흔들린다.
 * 쓰는 법: beforeAll(warmAppRoot). 대기 시간은 전역 값 그대로(#77 규칙 — 테스트마다 timeout 을 주지 않는다)
 */
export async function warmAppRoot() {
  const r = render(<AppRoot api={createFakeApi()} />);
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
  r.unmount();
}
