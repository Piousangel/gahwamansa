import React from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {Screen} from '../../ui/Screen';
import {copy, withTitle} from '../../copy/copy';
import {CodeShow} from '../link/CodeShow';

// C2: 번호가 만들어졌어요(큰 숫자) + 보내기 + 연결 기다리기
// 대기 화면에서 "번호 다시 보기"로 왔으면 돌아가고(goBack), 처음 만든 뒤면 대기 화면으로 바꾼다(replace).
// 그래서 스택에 대기 화면이 둘 쌓이지 않는다.
export function ChildCodeScreen({navigation, route}: NativeStackScreenProps<ChildParams, 'Code'>) {
  const {code, title} = route.params;
  const t = copy.code;
  return (
    <Screen>
      <CodeShow
        code={code}
        title={t.title}
        lines={[withTitle(t.use_on, title), t.valid]}
        shareMessage={t.share_message}
        sendLabel={t.send}
        primaryLabel={t.wait}
        onPrimary={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Wait'))}
      />
    </Screen>
  );
}
