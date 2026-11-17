import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {appCopy, tempCopy, Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';
import type {ChildSummary} from '../types';
import {formatAnswerDate} from './formatDate';



export function ChildHome() {
  const {api} = useSession();
  const [info, setInfo] = useState<ChildSummary | null>(null);
  const [error, setError] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  // 조회 실패는 '아직 안 했어요'가 아니라 오류 상태로 따로 보여 준다.
  const load = useCallback(() => {
    const mine = ++seq.current;
    setLoading(true);
    api
      .fetchChildSummary()
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
  const c = tempCopy.child;
  return (
    <Screen>
      <Text20 size={24} weight="bold">{`${info?.parentTitle ?? '부모님'}${c.titleSuffix}`}</Text20>
      {loading && !info ? (
        <Text20>{appCopy.loading}</Text20>
      ) : info && !info.shared ? (
        <Text20>{c.notShared}</Text20>
      ) : info?.latest ? (
        <>
          <Text20 size={36} weight="bold">{info.latest.choiceLabel}</Text20>
          <Text20>{formatAnswerDate(info.latest.answeredDate)}</Text20>
          <Text20 size={24}>{`${info.latest.choiceLabel}${c.talk}`}</Text20>
        </>
      ) : (
        <Text20>{c.noAnswer}</Text20>
      )}
    </Screen>
  );
}
