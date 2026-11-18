// 테스트용 앱 조립: App.tsx 와 같은 모양(DevMenuHost 가 AppRoot 를 감싼다), fake API·자녀 역할로 시작
import React from 'react';
import {AppRoot} from '../src/app/AppRoot';
import {DevMenuHost} from '../src/dev/DevMenuHost';
import {createFakeApi} from '../src/features/fakeApi';

const api = createFakeApi({consented: true});
export function App() {
  return (
    <DevMenuHost api={api}>
      {({appKey, role}) => <AppRoot key={appKey} api={api} role={role ?? 'child'} />}
    </DevMenuHost>
  );
}
