import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {ChildHome} from '../features/home/ChildHome';
import {ChildReport} from '../features/home/ChildReport';

const Tab = createBottomTabNavigator();
export function ChildTabs() {
  return (
    <Tab.Navigator screenOptions={{headerShown: false}}>
      <Tab.Screen name="홈" component={ChildHome} />
      <Tab.Screen name="리포트" component={ChildReport} />
    </Tab.Navigator>
  );
}
