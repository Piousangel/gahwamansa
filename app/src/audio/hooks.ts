// 오디오 상태를 화면에 잇는 훅. 판단은 lib/audioPolicy(순수) 하나, 여기는 입력을 모아 넣고 결과를 적용만 한다.
import {useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {audioPolicy, type AudioInputs, type Ringer} from '../lib/audioPolicy';
import {useScreenReader} from '../ui/a11y';
import type {SoundHandle} from './audioCore';
import {getRinger, subscribeRinger} from './engines';
import {audio} from './instance';

/** 지금 읽어 주는 중인지(화면의 '읽는 중' 표시·멈춤 버튼). */
export function useSpeaking(): boolean {
  const [on, setOn] = useState(() => audio().isSpeaking());
  useEffect(() => audio().subscribe(setOn), []);
  return on;
}

/**
 * audioPolicy 입력 모으기: 앱 활성·벨소리 모드(바뀌면 따라감, 앱으로 돌아올 때 다시 읽음)·화면 읽기·읽어 주는 중.
 * outputLost(이어폰 빠짐)는 세 라이브러리 어디에도 없어 아직 false — 필요하면 AUDIO_BECOMING_NOISY 로컬 모듈(QA-04 5번 결과 보고 결정).
 */
export function useAudioInputs(o: {bgmEnabled: boolean; bgmScreen: boolean}): AudioInputs {
  const screenReader = useScreenReader();
  const ttsSpeaking = useSpeaking();
  const [ringer, setRinger] = useState<Ringer>('unknown');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let alive = true;
    const read = () => getRinger().then(r => alive && setRinger(r));
    read();
    const unsubRinger = subscribeRinger(r => alive && setRinger(r));
    const sub = AppState.addEventListener('change', s => {
      setAppActive(s === 'active');
      if (s === 'active') {
        read();
      }
    });
    return () => {
      alive = false;
      unsubRinger();
      sub?.remove();
    };
  }, []);
  return useMemo(
    () => ({bgmEnabled: o.bgmEnabled, bgmScreen: o.bgmScreen, ringer, screenReader, ttsSpeaking, appActive, outputLost: false}),
    [o.bgmEnabled, o.bgmScreen, ringer, screenReader, ttsSpeaking, appActive],
  );
}

/**
 * 배경 음악 한 곡: 정책이 play 면 반복 재생(읽어 주는 동안 10%), stop 이면 정지. 돌아와도 자동 재생은 정책이 다시 play 일 때만.
 * track 은 화면이 loadSound(res/raw 이름 또는 require 자산)로 만든 것(음원은 CT-04, 연결은 AP-04).
 */
export function useBgm(track: SoundHandle | null, o: {enabled: boolean; screen: boolean}) {
  const inputs = useAudioInputs({bgmEnabled: o.enabled, bgmScreen: o.screen});
  const decision = audioPolicy(inputs).bgm;
  const ctl = useRef<ReturnType<ReturnType<typeof audio>['bgm']> | null>(null);
  useEffect(() => {
    if (!track) {
      return;
    }
    ctl.current = audio().bgm(track);
    return () => {
      ctl.current?.stop();
      ctl.current = null;
    };
  }, [track]);
  useEffect(() => {
    if (decision === 'play') {
      ctl.current?.play();
    } else {
      ctl.current?.stop();
    }
  }, [decision, track]);
  return decision;
}
