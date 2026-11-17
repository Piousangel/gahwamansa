import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ConnectScreen} from '../features/link/ConnectScreen';
import type {Prefill} from '../features/link/useConnectFlow';
import {ConsentScreen} from '../features/link/ConsentScreen';
import {CourseHome} from '../features/course/CourseHome';
import {PhotoStep} from '../features/course/PhotoStep';
import {QuestionStep} from '../features/course/QuestionStep';
import {DeleteAccountScreen} from '../features/account/DeleteAccountScreen';
import {ParentSettings} from '../features/account/ParentSettings';
import {DeleteDoneScreen} from '../features/account/DeleteDoneScreen';
import {HangulStep} from '../features/course/HangulStep';

export type ParentParams = {
  // prefill: 밖에서 들어온 번호(App Links·Install Referrer, ease-and-joy A②). 연결은 사람이 확인 화면에서 누른다
  Connect: {from?: 'course'; prefill?: Prefill} | undefined; Consent: undefined; CourseHome: undefined;
  PhotoStep: undefined; QuestionStep: undefined; HangulStep: undefined;
  Settings: undefined; DeleteAccount: undefined; DeleteDone: undefined;
};
const Stack = createNativeStackNavigator<ParentParams>();

export function ParentStack({initialRouteName = 'Connect'}: {initialRouteName?: keyof ParentParams}) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{headerShown: false}}>
      <Stack.Screen name="Connect" component={ConnectScreen} />
      <Stack.Screen name="Consent" component={ConsentScreen} />
      <Stack.Screen name="CourseHome" component={CourseHome} />
      <Stack.Screen name="PhotoStep" component={PhotoStep} />
      <Stack.Screen name="QuestionStep" component={QuestionStep} />
      <Stack.Screen name="HangulStep" component={HangulStep} />
      <Stack.Screen name="Settings" component={ParentSettings} />
      <Stack.Screen name="DeleteAccount">{() => <DeleteAccountScreen role="parent" />}</Stack.Screen>
      <Stack.Screen name="DeleteDone" component={DeleteDoneScreen} />
    </Stack.Navigator>
  );
}
