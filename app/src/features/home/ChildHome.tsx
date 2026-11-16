import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {appCopy, copy, Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';

type Info = {participatedToday: boolean; streak: number};

export function ChildHome() {
  const {api} = useSession();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  // 조회 실패는 '아직 안 했어요'가 아니라 오류 상태로 따로 보여 준다.
  const load = useCallback(() => {
    const mine = ++seq.current;
    setLoading(true);
    api
      .fetchChildHome()
      .then(r => {
        if (mine === seq.current) {
          setInfo(r);
          setError(null);
        }
      })
      .catch(e => {
        if (mine === seq.current) {
          setError(errorMessage(e));
        }
      })
      .finally(() => {
        if (mine === seq.current) {
          setLoading(false);
        }
      });
  }, [api]);

  useFocusEffect(load);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        load();
      }
    });
    return () => sub.remove();
  }, [load]);

  if (error) {
    return (
      <Screen>
        <Text20 size={24} weight="bold">{error.title}</Text20>
        <Text20>{error.body}</Text20>
        <BigButton variant="secondary" label={error.button} onPress={load} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Text20 size={24} weight="bold">오늘 참여 여부</Text20>
      {loading && !info ? (
        <Text20>{appCopy.loading}</Text20>
      ) : (
        <>
          <Text20>{info?.participatedToday ? '오늘 참여하셨어요' : '오늘은 아직이에요'}</Text20>
          <Text20>{`연속 ${info?.streak ?? 0}일`}</Text20>
        </>
      )}
      <Text20 size={24} weight="bold">응원 한마디</Text20>
      <Text20>{copy.cheers.well_done}</Text20>
    </Screen>
  );
}
