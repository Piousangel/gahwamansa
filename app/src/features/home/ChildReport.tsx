import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {DeleteLink} from '../account/DeleteLink';
import {copy} from '../../copy/copy';

export function ChildReport() {
  const navigation = useNavigation();
  return (
    <Screen>
      <Text20 size={24} weight="bold">{copy.child.past_title}</Text20>
      <Text20>{copy.child.no_answer}</Text20>
      <DeleteLink label={copy.child.delete_link} minHeight={48} onPress={() => navigation.navigate('DeleteAccount' as never)} />
    </Screen>
  );
}
