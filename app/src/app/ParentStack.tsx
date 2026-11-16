import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ConnectScreen} from '../features/link/ConnectScreen';
import {ConsentScreen} from '../features/link/ConsentScreen';
import {CourseHome} from '../features/course/CourseHome';
import {PhotoStep} from '../features/course/PhotoStep';
import {QuestionStep} from '../features/course/QuestionStep';
import {HangulStep} from '../features/course/HangulStep';

export type ParentParams = {
  Connect: undefined; Consent: undefined; CourseHome: undefined;
  PhotoStep: undefined; QuestionStep: undefined; HangulStep: undefined;
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
    </Stack.Navigator>
  );
}
