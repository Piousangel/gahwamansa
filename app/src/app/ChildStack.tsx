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
import {copy} from '../copy/copy';

const Tab = createBottomTabNavigator();
export type ChildParams = {
  Gate: undefined;
  Login: undefined;
  Relation: undefined;
  Code: {code: string; title: string};
  Wait: undefined;
  Tabs: undefined;
  DeleteAccount: undefined;
  DeleteDone: undefined;
};
const Stack = createNativeStackNavigator<ChildParams>();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{headerShown: false}}>
      <Tab.Screen name={copy.child.tab_album} component={ChildHome} />
      <Tab.Screen name={copy.child.tab_past} component={ChildReport} />
    </Tab.Navigator>
  );
}

// 자녀 스택. 보통 Gate(로그인·가족·연결 상태로 첫 화면 결정)에서 시작한다.
// initialRouteName='Tabs' 는 이미 로그인·연결된 자녀로 바로 여는 경우(테스트·역할 지정 실행).
export function ChildStack({initialRouteName = 'Gate'}: {initialRouteName?: keyof ChildParams}) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{headerShown: false}}>
      <Stack.Screen name="Gate" component={ChildGate} />
      <Stack.Screen name="Login" component={ChildLogin} />
      <Stack.Screen name="Relation" component={RelationScreen} />
      <Stack.Screen name="Code" component={ChildCodeScreen} />
      <Stack.Screen name="Wait" component={ChildWaitScreen} />
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="DeleteAccount">{() => <DeleteAccountScreen role="child" />}</Stack.Screen>
      <Stack.Screen name="DeleteDone" component={DeleteDoneScreen} />
    </Stack.Navigator>
  );
}
