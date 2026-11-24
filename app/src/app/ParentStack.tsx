import React from 'react';
import {Platform} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ConnectScreen} from '../features/link/ConnectScreen';
import {ParentFamilyScreen} from '../features/family/ParentFamilyScreen';
import {HistoryScreen} from '../features/course/HistoryScreen';
import {HistoryDayScreen} from '../features/course/HistoryDayScreen';
import type {HistoryDay} from '../api/contract/history';
import type {Prefill} from '../features/link/useConnectFlow';
import {ConsentScreen} from '../features/link/ConsentScreen';
import {CourseHome} from '../features/course/CourseHome';
import {PhotoStep} from '../features/course/PhotoStep';
import {TodayReviewScreen} from '../features/course/TodayReviewScreen';
import {QuestionStep} from '../features/course/QuestionStep';
import {DeleteAccountScreen} from '../features/account/DeleteAccountScreen';
import {ParentSettings} from '../features/account/ParentSettings';
import {DeleteDoneScreen} from '../features/account/DeleteDoneScreen';
import {KeyboardStep} from '../features/course/KeyboardStep';
import {CourseDone} from '../features/course/CourseDone';
import {WebScreen, type WebParams} from './WebScreen';
import {OssScreen} from './OssScreen';
import {FamilyPreviewScreen} from '../features/account/FamilyPreview';
import {stackScreenOptions} from '../navigation/stackOptions';

export type ParentParams = {
  // prefill: 밖에서 들어온 번호(App Links·Install Referrer, ease-and-joy A②). 연결은 사람이 확인 화면에서 누른다
  Connect: {from?: 'course'; prefill?: Prefill} | undefined; Consent: undefined; CourseHome: undefined;
  PhotoStep: {review?: boolean} | undefined; QuestionStep: {review?: boolean} | undefined; KeyboardStep: {review?: boolean} | undefined; CourseDone: undefined;
  TodayReview: undefined; // D-3 '오늘 코스 다시 보기' 안 A '오늘 한 장'
  History: undefined; HistoryDay: {day: HistoryDay};
  Settings: {expand?: 'resume'} | undefined; Family: undefined; DeleteAccount: undefined; DeleteDone: undefined;
  Web: WebParams; // 앱 안 웹 화면(AU-07)
  Oss: undefined; // 오픈소스 라이선스(AU-06)
  FamilyPreview: undefined; // P13 '가족에게 이렇게 보여요'(AP-06)
};
const Stack = createNativeStackNavigator<ParentParams>();

export function ParentStack({initialRouteName = 'Connect', prefill}: {initialRouteName?: keyof ParentParams; prefill?: Prefill}) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={stackScreenOptions(Platform.OS)}>
      <Stack.Screen name="Connect" component={ConnectScreen} initialParams={prefill ? {prefill} : undefined} />
      <Stack.Screen name="Consent" component={ConsentScreen} />
      <Stack.Screen name="CourseHome" component={CourseHome} />
      <Stack.Screen name="PhotoStep" component={PhotoStep} />
      <Stack.Screen name="QuestionStep" component={QuestionStep} />
      <Stack.Screen name="KeyboardStep" component={KeyboardStep} />
      <Stack.Screen name="CourseDone" component={CourseDone} />
      <Stack.Screen name="TodayReview" component={TodayReviewScreen} />
      <Stack.Screen name="Settings" component={ParentSettings} />
      <Stack.Screen name="Family" component={ParentFamilyScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="HistoryDay" component={HistoryDayScreen} />
      <Stack.Screen name="DeleteAccount">{() => <DeleteAccountScreen role="parent" />}</Stack.Screen>
      <Stack.Screen name="DeleteDone" component={DeleteDoneScreen} />
      <Stack.Screen name="Web" component={WebScreen} />
      <Stack.Screen name="Oss" component={OssScreen} />
      <Stack.Screen name="FamilyPreview" component={FamilyPreviewScreen} />
    </Stack.Navigator>
  );
}
