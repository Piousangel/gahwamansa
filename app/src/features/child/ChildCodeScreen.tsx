import React from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {BackBar} from '../../app/BackBar';
import {copy, withTitle} from '../../copy/copy';
import {CodeShow} from '../link/CodeShow';
import {buildShareMessage, formatExpiry} from '../../lib/childFormat';
import {appShareLink} from '../../lib/env';
import {useApi} from '../../shared/useChildData';
import {track} from '../track';

// C2: 번호가 만들어졌어요(큰 숫자) + 보내기 + 돌아가기. v4(V9)부터 가입 흐름(C1)은 C2 없이 C3 로 가고, 이 화면은 재연결 번호(설정·홈 끊김 배너)에서만 쓴다.
// 대기 화면에서 "번호 다시 보기"로 왔으면 돌아가고(goBack), 처음 만든 뒤면 대기 화면으로 바꾼다(replace).
// 그래서 스택에 대기 화면이 둘 쌓이지 않는다. 이전 바는 돌아갈 화면이 있을 때만 보인다.
export function ChildCodeScreen({navigation, route}: NativeStackScreenProps<ChildParams, 'Code'>) {
  const {code, title, renewed, expiresAt} = route.params;
  const t = copy.code;
  const api = useApi();
  return (
    <CodeShow
      onShare={() => track(api, 'invite_share_tapped', {channel: 'share_sheet'})} // AC-05
      top={<BackBar />} // 감사 M10: C1 에서 왔으면 '‹ 이전'은 C1(호칭)으로
      code={code}
      title={t.title}
      lines={renewed ? [withTitle(t.use_on, title), t.valid, t.old_invalid] : [withTitle(t.use_on, title), t.valid]}
      shareMessage={buildShareMessage(t.share, copy.safe.money, code, expiresAt ? formatExpiry(expiresAt) : null, appShareLink(code))}
      sendLabel={t.send}
      primaryLabel={t.wait}
      // 재연결 번호(설정 '새 폰 연결 번호'·홈 끊김 배너)에서만 온다 — 온 화면으로 돌아간다(C1 가입 흐름은 C2 없이 바로 C3, V9)
      onPrimary={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Wait'))}
    />
  );
}
