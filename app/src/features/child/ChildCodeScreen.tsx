import React from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {BackBar, useBackDestination} from '../../app/BackBar';
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
  const backTo = useBackDestination();
  return (
    <CodeShow
      onShare={() => track(api, 'invite_share_tapped', {channel: 'share_sheet'})} // AC-05
      top={<BackBar />} // 감사 M10: C1 에서 왔으면 '‹ 이전'은 C1(호칭)으로
      code={code}
      title={t.title}
      lines={renewed ? [withTitle(t.use_on, title), t.valid, t.old_invalid] : [withTitle(t.use_on, title), t.valid]}
      shareMessage={buildShareMessage(t.share, copy.safe.money, code, expiresAt ? formatExpiry(expiresAt) : null, appShareLink(code))}
      sendLabel={t.send}
      // #152 리뷰 L(W-09·NAMES '뒤로 = 목적지 문구'): 보조 버튼은 실제로 돌아갈 화면 이름. 옛 '연결 기다리기'(code.wait)는 목적지와 달랐다.
      //   스택 아래 화면(설정·앨범)이 있으면 그 이름, 없으면 바꿔 갈 C3 '기다리는 화면으로'(nav.to.Wait — 라이터 확인 전, backDestination 주석)
      primaryLabel={backTo ?? copy.nav.to.Wait}
      // 재연결 번호(설정 '새 폰 연결 번호'·홈 끊김 배너)에서만 온다 — 온 화면으로 돌아간다(C1 가입 흐름은 C2 없이 바로 C3, V9)
      onPrimary={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Wait'))}
    />
  );
}
