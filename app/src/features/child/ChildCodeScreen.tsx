import React from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {BackBar} from '../../app/BackBar';
import {copy, withTitle} from '../../copy/copy';
import {CodeShow} from '../link/CodeShow';
import {buildShareMessage, formatExpiry} from '../../lib/childFormat';
import {appShareLink} from '../../lib/env';

// C2: 번호가 만들어졌어요(큰 숫자) + 보내기 + 연결 기다리기
// 대기 화면에서 "번호 다시 보기"로 왔으면 돌아가고(goBack), 처음 만든 뒤면 대기 화면으로 바꾼다(replace).
// 그래서 스택에 대기 화면이 둘 쌓이지 않는다. 이전 바는 돌아갈 화면이 있을 때만 보인다.
export function ChildCodeScreen({navigation, route}: NativeStackScreenProps<ChildParams, 'Code'>) {
  const {code, title, renewed, expiresAt, from} = route.params;
  const t = copy.code;
  return (
    <CodeShow
      top={<BackBar />} // 감사 M10: C1 에서 왔으면 '‹ 이전'은 C1(호칭)으로
      code={code}
      title={t.title}
      lines={renewed ? [withTitle(t.use_on, title), t.valid, t.old_invalid] : [withTitle(t.use_on, title), t.valid]}
      shareMessage={buildShareMessage(t.share, copy.safe.money, code, expiresAt ? formatExpiry(expiresAt) : null, appShareLink(code))}
      sendLabel={t.send}
      primaryLabel={t.wait}
      // C1 에서 처음 만든 뒤면 [Relation, Code] 를 대기 화면 하나로 바꾼다(스택에 C1·C2 가 남지 않게), 대기 화면에서 왔으면 돌아간다
      onPrimary={() => (from === 'relation' ? navigation.reset({index: 0, routes: [{name: 'Wait'}]}) : navigation.canGoBack() ? navigation.goBack() : navigation.replace('Wait'))}
    />
  );
}
