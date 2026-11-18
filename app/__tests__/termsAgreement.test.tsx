// 어르신 약관·방침 동의 기록(서버 0046·0048 record_terms_agreement, 법률 Q2) + 삭제 범위 'none'(0049).
import React from 'react';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {parseMyTermsStatus, parseRecordTerms, PRIVACY_VERSION, TERMS_VERSION, TERMS_VERSION_RE} from '../src/api/contract/terms';
import {parseDeleteScope} from '../src/api/contract/deleteScope';
import {enterCode} from '../testUtils/flow';

declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');

test('계약 검증기: 모르는 모양은 null', () => {
  expect(parseRecordTerms({ok: true, recorded: false})).toEqual({ok: true, recorded: false});
  expect(parseRecordTerms({ok: false, reason: 'unknown_version'})).toEqual({ok: false, reason: 'unknown_version'});
  expect(parseRecordTerms({ok: false, reason: 'nope'})).toBeNull();
  expect(parseRecordTerms({})).toBeNull();
  // my_terms_status 는 needs_reagree 만 읽는다(다른 값은 버림)
  expect(parseMyTermsStatus({latest_terms: 'v1', latest_privacy: 'v1', needs_reagree: true, terms_version: 'v0'})).toEqual({needsReagree: true});
  expect(parseMyTermsStatus({})).toBeNull();
  expect(parseDeleteScope({scope: 'none'})).toEqual({scope: 'none'}); // 0049 가족 연결 전 계정
  expect(parseDeleteScope({scope: 'family'})).toEqual({scope: 'family'});
  expect(parseDeleteScope({scope: 'other'})).toBeNull();
});

test('버전 표기 규칙: 앱 상수 = 게시본 문서 머리의 "버전 N"(= 서버 vN)', () => {
  const head = (f: string) => {
    const m = /버전 (\d+(?:\.\d+)?)/.exec(fs.readFileSync(path.join(__dirname, '../../docs/team/legal/publish-drafts', f), 'utf8'));
    return m ? `v${m[1]}` : null;
  };
  expect(TERMS_VERSION).toBe(head('terms.html'));
  expect(PRIVACY_VERSION).toBe(head('privacy.html'));
  expect(TERMS_VERSION).toMatch(TERMS_VERSION_RE);
  expect(PRIVACY_VERSION).toMatch(TERMS_VERSION_RE);
});

test('realApi: record_terms_agreement·my_terms_status·delete_scope_preview(none) 를 부르고 검증한다', async () => {
  const rpc = jest.fn((name: string) =>
    Promise.resolve({
      data:
        name === 'record_terms_agreement'
          ? {ok: true, recorded: true}
          : name === 'my_terms_status'
            ? {latest_terms: 'v1', latest_privacy: 'v1', needs_reagree: false}
            : {scope: 'none'},
      error: null,
    }),
  );
  const api = createRealApi({rpc} as never);
  expect(await api.recordTermsAgreement('v1', 'v1')).toEqual({ok: true, recorded: true});
  expect(rpc).toHaveBeenCalledWith('record_terms_agreement', {p_terms_version: 'v1', p_privacy_version: 'v1'});
  expect(await api.myTermsStatus()).toEqual({needsReagree: false});
  expect(await api.deleteScopePreview()).toEqual({scope: 'none'});
});

test('어르신 P1c: [이 번호로 연결하기]를 누르면 약관·방침 동의를 앱 상수 버전으로 한 번 기록(연결을 기다리게 하지 않음)', async () => {
  const api = createFakeApi({parentTitle: '엄마', childFamily: true});
  const rec = jest.spyOn(api, 'recordTermsAgreement');
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  expect(rec).toHaveBeenCalledTimes(1);
  expect(rec).toHaveBeenCalledWith(TERMS_VERSION, PRIVACY_VERSION);
});

test('기록이 실패해도 연결은 되고, 연결 성공 뒤 한 번 더 기록한다(같은 쌍은 서버가 한 번만 남김)', async () => {
  const api = createFakeApi({parentTitle: '엄마', childFamily: true, termsResult: 'offline'});
  const rec = jest.spyOn(api, 'recordTermsAgreement');
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  await waitFor(() => expect(rec).toHaveBeenCalledTimes(2));
});
