import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {DeleteLink} from '../account/DeleteLink';

export function ChildReport() {
  const navigation = useNavigation();
  return (
    <Screen>
      <Text20 size={24} weight="bold">리포트</Text20>
      <Text20>기본 요약은 곧 이곳에서 볼 수 있어요</Text20>
      <DeleteLink minHeight={48} onPress={() => navigation.navigate('DeleteAccount' as never)} />
    </Screen>
  );
}
