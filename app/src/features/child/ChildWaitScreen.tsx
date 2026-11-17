import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Share} from 'react-native';
import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {appCopy, copy, withTitle, Message} from '../../copy/copy';
import {formatCode} from '../../ui/codeInputLogic';
import type {ChildState} from '../types';
import {errorMessage} from '../course/useFinishStep';

const POLL_MS = 15000;
type Family = Extract<ChildState, {kind: 'family'}>;

// C3: 연결 대기. 처음·포그라운드 복귀·15초마다 확인(화면당 타이머 하나, 겹치는 요청 없음, 백그라운드·연결 후·언마운트 시 멈춤).
export function ChildWaitScreen({navigation}: NativeStackScreenProps<ChildParams, 'Wait'>) {
  const {api} = useSession();
  const [state, setState] = useState<Family | null>(null);
  const [error, setError] = useState<Message | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      const s = await api.getChildState();
      if (alive.current && s.kind === 'family') {
        setState(s);
        setError(null);
      }
    } catch (e) {
      if (alive.current) {
        setError(errorMessage(e));
      }
    } finally {
      inFlight.current = false;
    }
  }, [api]);

  const linked = !!state?.linked;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    check();
  }, [check]);
  useEffect(() => {
    if (linked) {
      return; // 연결되면 더 확인하지 않는다
    }
    let timer: ReturnType<typeof setInterval> | null = setInterval(check, POLL_MS);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        check();
        if (!timer) {
          timer = setInterval(check, POLL_MS);
        }
      } else if (timer) {
        clearInterval(timer); // 백그라운드에서는 멈춘다
        timer = null;
      }
    });
    return () => {
      if (timer) {
        clearInterval(timer);
      }
      sub.remove();
    };
  }, [check, linked]);

  const title = state?.parentTitle ?? '부모님';
  const showCode = async () => {
    if (!state) {
      return;
    }
    try {
      const code = state.code?.code ?? (await api.issueInviteCode()); // 쓸 수 있는 번호가 없을 때만 새로 만든다
      navigation.navigate('Code', {code, title});
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const send = () => {
    const code = state?.code?.code;
    if (code) {
      Share.share({message: copy.code.share_message.split('{번호}').join(formatCode(code))}).catch(() => {});
    }
  };

  if (linked) {
    const d = copy.connect_done;
    return (
      <Screen>
        <Text20 size={28} weight="bold">{d.title}</Text20>
        {d.body.map(l => (
          <Text20 key={l}>{withTitle(l, title)}</Text20>
        ))}
        <BigButton
          label={d.button}
          onPress={() => navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Tabs'}]}))}
        />
      </Screen>
    );
  }
  const w = copy.connect_wait;
  return (
    <Screen>
      <Text20 size={28} weight="bold">{w.title}</Text20>
      {state ? <Text20>{withTitle(w.body, title)}</Text20> : <Text20>{appCopy.loading}</Text20>}
      {error ? (
        <>
          <Text20 weight="bold" accessibilityLiveRegion="polite">{error.title}</Text20>
          <BigButton variant="secondary" label={error.button} onPress={check} />
        </>
      ) : null}
      <BigButton label={w.show_code} disabled={!state} onPress={showCode} />
      <BigButton variant="secondary" label={w.send} disabled={!state?.code} onPress={send} />
    </Screen>
  );
}
