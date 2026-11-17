import React, {useCallback, useEffect, useState} from 'react';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {appCopy, copy, Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';

// 자녀 시작 화면 결정: 어르신 폰 -> 막음 / 로그인 안 됨 -> 로그인 / 가족 없음 -> 호칭 / 연결 대기 -> 대기 / 연결됨 -> 앨범.
export function ChildGate() {
  const navigation = useNavigation();
  const {api, resetRole} = useSession();
  const [error, setError] = useState<Message | null>(null);
  const [parentPhone, setParentPhone] = useState(false);

  const decide = useCallback(async () => {
    setError(null);
    try {
      const go = (name: string) => navigation.dispatch(CommonActions.reset({index: 0, routes: [{name}]}));
      const who = await api.whoAmI();
      if (who === 'parent') {
        // 이 기기는 어르신으로 연결돼 있다. 자녀로 로그인하면 세션을 덮어써 어르신 연결이 끊기므로 막는다.
        setParentPhone(true);
        return;
      }
      if (who !== 'child') {
        go('Login');
        return;
      }
      const s = await api.getChildState();
      go(s.kind === 'no_family' ? 'Relation' : s.linked ? 'Tabs' : 'Wait');
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [api, navigation]);

  useEffect(() => {
    decide();
  }, [decide]);

  if (parentPhone) {
    return (
      <Screen top={<BackBar onBack={resetRole} />} bottom={<BigButton label={copy.login.back} onPress={resetRole} />}>
        <Text20 size={26} weight="bold">{copy.login.parent_device}</Text20>
      </Screen>
    );
  }
  return (
    <Screen>
      {error ? (
        <>
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
          <BigButton variant="secondary" label={error.button} onPress={decide} />
        </>
      ) : (
        <Text20>{appCopy.loading}</Text20>
      )}
    </Screen>
  );
}
