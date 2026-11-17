import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ConnectScreen} from '../features/link/ConnectScreen';
import {ConsentScreen} from '../features/link/ConsentScreen';
import {CourseHome} from '../features/course/CourseHome';
import {PhotoStep} from '../features/course/PhotoStep';
import {QuestionStep} from '../features/course/QuestionStep';
import {DeleteAccountScreen} from '../features/account/DeleteAccountScreen';
import {ParentSettings} from '../features/account/ParentSettings';
import {DeleteDoneScreen} from '../features/account/DeleteDoneScreen';
import {KeyboardStep} from '../features/course/KeyboardStep';
import {CourseDone} from '../features/course/CourseDone';

export type ParentParams = {
  Connect: {from?: 'course'} | undefined; Consent: undefined; CourseHome: undefined;
  PhotoStep: {review?: boolean} | undefined; QuestionStep: undefined; KeyboardStep: undefined; CourseDone: undefined;
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
      <Stack.Screen name="KeyboardStep" component={KeyboardStep} />
      <Stack.Screen name="CourseDone" component={CourseDone} />
      <Stack.Screen name="Settings" component={ParentSettings} />
      <Stack.Screen name="DeleteAccount">{() => <DeleteAccountScreen role="parent" />}</Stack.Screen>
      <Stack.Screen name="DeleteDone" component={DeleteDoneScreen} />
    </Stack.Navigator>
  );
}
