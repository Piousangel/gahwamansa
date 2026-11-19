// 오디오를 화면에 잇는 훅. 판단은 lib/audioPolicy(순수) 하나, 여기는 입력을 모아 넣고 결과를 적용·정리만 한다.
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {audioPolicy, readAloudAllowed, type AudioInputs, type Ringer} from '../lib/audioPolicy';
import {useScreenReader} from '../ui/a11y';
import type {SoundHandle, SpeakResult} from './audioCore';
import {getRinger, loadSound, subscribeRinger} from './engines';
import {audio} from './instance';

export {bindAppLifecycle} from './instance';

/** 지금 읽어 주는 중인지(화면의 '읽는 중' 표시·멈춤 버튼). */
export function useSpeaking(): boolean {
  const [on, setOn] = useState(() => audio().isSpeaking());
  useEffect(() => audio().subscribe(setOn), []);
  return on;
}

/**
 * '읽어 주세요' 화면용(리뷰 M1·L3). 화면 읽기 값은 이 훅이 직접 읽는다(호출부가 넘기지 않음).
 * 이 화면이 시작한 읽기는 화면을 떠날 때(언마운트) 멈추고, 화면 읽기가 켜지면 바로 멈춘다. 앱이 뒤로 가면 bindAppLifecycle 이 멈춘다.
 */
export function useReadAloud(): {
  allowed: boolean;
  speaking: boolean;
  speak: (text: string) => Promise<SpeakResult>;
  stop: () => Promise<void>;
} {
  const screenReader = useScreenReader();
  const speaking = useSpeaking();
  const started = useRef(false);
  const speak = useCallback(
    (text: string) => {
      started.current = true;
      return audio().speak(text, {screenReader});
    },
    [screenReader],
  );
  const stop = useCallback(() => audio().stopSpeaking(), []);
  useEffect(() => {
    if (screenReader) {
      audio().stopSpeaking();
    }
  }, [screenReader]);
  useEffect(
    () => () => {
      if (started.current) {
        audio().stopSpeaking();
      }
    },
    [],
  );
  return {allowed: readAloudAllowed(screenReader), speaking, speak, stop};
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
 * 배경 음악 한 곡. 이 훅이 트랙을 열고(load) 화면을 떠날 때 멈추고 해제(release)까지 한다(리뷰 M5 — 호출부는 자산만 넘긴다).
 * - 정책이 play 면 반복 재생(읽어 주는 동안 5%), stop 이면 정지.
 * - 앱이 뒤로 가거나 출력이 끊겨 멈췄으면, 돌아와도 저절로 다시 틀지 않는다(스파이크 6-5, 리뷰 M2). 사용자가 음악을 껐다 켜면 다시 튼다.
 * 음원은 CT-04, 화면 연결은 AP-04.
 */
export function useBgm(
  asset: number | string | null,
  o: {enabled: boolean; screen: boolean; load?: (a: number | string) => SoundHandle | null},
): 'play' | 'stop' {
  const inputs = useAudioInputs({bgmEnabled: o.enabled, bgmScreen: o.screen});
  const [held, setHeld] = useState(false);
  const decision = held ? 'stop' : audioPolicy(inputs).bgm;
  const ctl = useRef<ReturnType<ReturnType<typeof audio>['bgm']> | null>(null);
  const wasPlaying = useRef(false);
  const load = o.load ?? loadSound;
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (asset === null) {
      return;
    }
    const track = loadRef.current(asset);
    if (!track) {
      return;
    }
    ctl.current = audio().bgm(track);
    return () => {
      ctl.current?.stop();
      ctl.current = null;
      wasPlaying.current = false;
      track.release();
    };
  }, [asset]);

  // 사용자가 끄면 '멈춤 유지'를 푼다(다시 켜면 튼다)
  useEffect(() => {
    if (!o.enabled) {
      setHeld(false);
    }
  }, [o.enabled]);

  // 시스템 사정(뒤로 감·출력 끊김)으로 멈추면, 그때 틀고 있었다면 멈춤 유지
  useEffect(() => {
    if ((!inputs.appActive || inputs.outputLost) && wasPlaying.current) {
      setHeld(true);
    }
  }, [inputs.appActive, inputs.outputLost]);

  useEffect(() => {
    if (decision === 'play') {
      ctl.current?.play();
      wasPlaying.current = !!ctl.current;
    } else {
      ctl.current?.stop();
      wasPlaying.current = false;
    }
  }, [decision, asset]);
  return decision;
}
