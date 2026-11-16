import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ChildHome} from '../features/home/ChildHome';
import {ChildReport} from '../features/home/ChildReport';
import {DeleteAccountScreen} from '../features/account/DeleteAccountScreen';
import {DeleteDoneScreen} from '../features/account/DeleteDoneScreen';
import {Screen} from '../ui/Screen';
import {Text20} from '../ui/Text20';
import {tempCopy} from '../copy/copy';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{headerShown: false}}>
      <Tab.Screen name="홈" component={ChildHome} />
      <Tab.Screen name="리포트" component={ChildReport} />
    </Tab.Navigator>
  );
}

// 로그인 화면은 아직 없다(카카오 연동 단계). 삭제 후 돌아올 자리표시.
function LoginPlaceholder() {
  return (
    <Screen>
      <Text20 size={24} weight="bold">{tempCopy.del.childLoginTitle}</Text20>
    </Screen>
  );
}

export function ChildTabs() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="DeleteAccount">{() => <DeleteAccountScreen role="child" />}</Stack.Screen>
      <Stack.Screen name="DeleteDone" component={DeleteDoneScreen} />
      <Stack.Screen name="Login" component={LoginPlaceholder} />
    </Stack.Navigator>
  );
}
