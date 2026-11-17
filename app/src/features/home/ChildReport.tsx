import React from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {DeleteLink} from '../account/DeleteLink';
import {copy} from '../../copy/copy';

export function ChildReport() {
  const navigation = useNavigation<NativeStackNavigationProp<ChildParams>>();
  return (
    <Screen>
      <Text20 size={24} weight="bold">{copy.child.past_title}</Text20>
      <Text20>{copy.child.no_answer}</Text20>
      <DeleteLink onPress={() => navigation.navigate('DeleteAccount')} />
    </Screen>
  );
}
