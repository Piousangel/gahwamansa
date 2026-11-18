import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ChildHome} from '../features/home/ChildHome';
import {ChildReport} from '../features/home/ChildReport';
import {DeleteAccountScreen} from '../features/account/DeleteAccountScreen';
import {DeleteDoneScreen} from '../features/account/DeleteDoneScreen';
import {ChildGate} from '../features/child/ChildGate';
import {ChildLogin} from '../features/child/ChildLogin';
import {RelationScreen} from '../features/child/RelationScreen';
import {ChildCodeScreen} from '../features/child/ChildCodeScreen';
import {ChildWaitScreen} from '../features/child/ChildWaitScreen';
import {ChildSettings} from '../features/child/ChildSettings';
import {ChildAppInfo} from '../features/child/ChildAppInfo';
import {ChildTabBar} from './ChildChrome';
import {ToastProvider} from '../ui/Toast';
import {NewConnectionBanner} from '../features/home/NewConnectionBanner';
import {useSession} from './session';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {copy} from '../copy/copy';
import {WebScreen, type WebParams} from './WebScreen';
import {OssScreen} from './OssScreen';

const Tab = createBottomTabNavigator();
export type ChildParams = {
  Gate: undefined;
  Login: undefined;
  Relation: undefined;
  Code: {code: string; title: string; renewed?: boolean; expiresAt?: string}; // renewed: 지난 번호가 만료돼 새로 받음, expiresAt: 아는 경우 공유 메시지 기한
  Wait: undefined;
  Tabs: undefined;
  Settings: undefined;
  AppInfo: undefined;
  DeleteAccount: undefined;
  DeleteDone: undefined;
  Web: WebParams; // 앱 안 웹 화면(AU-07)
  Oss: undefined; // 오픈소스 라이선스(AU-06)
};
const Stack = createNativeStackNavigator<ChildParams>();

const renderTabBar = (props: React.ComponentProps<typeof ChildTabBar>) => <ChildTabBar {...props} />;

// 하단 탭 바(앨범·지난 답): 연결된 뒤에만 보인다(연결 전에는 대기 화면, 탭 바 숨김 — 보드 A §3).
// 탭 화면 토스트는 탭 바 위에 띄운다(안쪽 Provider 가 바깥 것을 가린다).
const TAB_BAR_H = 68;
// N3 앱 안 배너: 탭 화면 위쪽(토스트와 다른 자리). '보기'는 앨범 탭으로
function Tabs({navigation}: NativeStackScreenProps<ChildParams, 'Tabs'>) {
  const {api} = useSession();
  return (
    <ToastProvider bottomOffset={TAB_BAR_H}>
      <Tab.Navigator screenOptions={{headerShown: false}} tabBar={renderTabBar}>
        <Tab.Screen name="Album" options={{title: copy.child.tab_album}} component={ChildHome} />
        <Tab.Screen name="Past" options={{title: copy.child.tab_past}} component={ChildReport} />
      </Tab.Navigator>
      <NewConnectionBanner api={api} onView={() => navigation.navigate('Tabs', {screen: 'Album'} as never)} />
    </ToastProvider>
  );
}

// 자녀 스택. 보통 Gate(로그인·가족·연결 상태로 첫 화면 결정)에서 시작한다.
// initialRouteName='Tabs' 는 이미 로그인·연결된 자녀로 바로 여는 경우(테스트·역할 지정 실행).
export function ChildStack({initialRouteName = 'Gate'}: {initialRouteName?: keyof ChildParams}) {
  return (
    // 자녀 화면 공용 토스트(U0). 시트·대화상자 위 오류는 토스트가 아니라 모달 안 오류 줄(리뷰 M2)
    <ToastProvider>
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{headerShown: false}}>
      <Stack.Screen name="Gate" component={ChildGate} />
      <Stack.Screen name="Login" component={ChildLogin} />
      <Stack.Screen name="Relation" component={RelationScreen} />
      <Stack.Screen name="Code" component={ChildCodeScreen} />
      <Stack.Screen name="Wait" component={ChildWaitScreen} />
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Settings" component={ChildSettings} />
      <Stack.Screen name="AppInfo" component={ChildAppInfo} />
      <Stack.Screen name="DeleteAccount">{() => <DeleteAccountScreen role="child" />}</Stack.Screen>
      <Stack.Screen name="DeleteDone" component={DeleteDoneScreen} />
      <Stack.Screen name="Web" component={WebScreen} />
      <Stack.Screen name="Oss" component={OssScreen} />
    </Stack.Navigator>
    </ToastProvider>
  );
}
