import React, {useCallback, useEffect, useState} from 'react';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {DsScreen, Heading, StateView, Text} from '../../ui/ds';
import {appCopy, copy, Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';
import {useBootLoading} from '../../app/splash';
import {retryChildTerms} from '../../shared/childTerms';

// 자녀 시작 화면 결정: 어르신 폰 -> 막음 / 로그인 안 됨 -> 로그인 / 가족 없음 -> 호칭 / 연결 대기 -> 대기 / 연결됨 -> 앨범.
export function ChildGate() {
  const navigation = useNavigation();
  const {api, resetRole} = useSession();
  const [error, setError] = useState<Message | null>(null);
  const [parentPhone, setParentPhone] = useState(false);
  const [deciding, setDeciding] = useState(true);
  useBootLoading(deciding && !error && !parentPhone); // 앱 시작 중이면 스플래시 대기 화면이 덮는다

  const decide = useCallback(async () => {
    setError(null);
    try {
      const go = (name: string) => navigation.dispatch(CommonActions.reset({index: 0, routes: [{name}]}));
      const who = await api.whoAmI();
      if (who === 'parent') {
        // 이 기기는 어르신으로 연결돼 있다. 자녀로 로그인하면 세션을 덮어써 어르신 연결이 끊기므로 막는다.
        setParentPhone(true);
        setDeciding(false);
        return;
      }
      if (who !== 'child') {
        go('Login');
        return;
      }
      retryChildTerms(api).catch(() => {}); // 지난 로그인의 약관 동의 기록이 실패했으면 한 번 다시(기다리지 않음)
      const s = await api.getChildState();
      go(s.kind === 'no_family' ? 'Relation' : s.linked ? 'Tabs' : 'Wait');
    } catch (e) {
      setError(errorMessage(e));
      setDeciding(false);
    }
  }, [api, navigation]);

  useEffect(() => {
    decide();
  }, [decide]);

  const blocked = copy.login.blocked_parent_device;
  // v4(공통 상태, 남은 자녀 화면 6번): 배치는 그대로, 부품만 ui/ds. 어르신 폰 막음 = DsScreen form(BackLink '처음으로' + Dock 하나),
  // 오류·확인 중 = StateView(오류는 나타날 때 한 번 읽음). audience 는 자녀 스택 루트(ChildStack)가 준다
  if (parentPhone) {
    return (
      <DsScreen
        variant="form"
        back={{label: copy.login.back, onPress: resetRole}}
        header={<Heading level={1}>{blocked.title}</Heading>}
        dock={{primary: {label: blocked.button, onPress: resetRole}}}>
        <Text role="bodyLg">{blocked.body}</Text>
      </DsScreen>
    );
  }
  return (
    <DsScreen variant="form">
      {error ? (
        <StateView testID="child-gate-error" kind="error" title={error.title} body={error.body || undefined} action={{label: error.button, onPress: decide}} />
      ) : (
        <StateView testID="child-gate-loading" kind="loading" title={appCopy.loading} />
      )}
    </DsScreen>
  );
}
