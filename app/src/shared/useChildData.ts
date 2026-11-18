import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSession} from '../app/session';
import {copy, Message} from '../copy/copy';
import type {Api, ChildSummary, ParentHistory} from '../features/types';
import {childErrorMessage} from './childError';

// 자녀 화면(홈·지난 답·설정)이 함께 쓰는 조회(기능 간 import 대신 shared, ARCHITECTURE §2). 화면에 들어올 때·앱으로 돌아올 때 다시 불러온다.
// 조회 실패는 '답 없음'이 아니라 오류로 따로 알린다. 리드 결정(리뷰 L1): 실패하면 이전 값을 지운다(동의 철회 뒤 옛 답이
// 남아 보이지 않게, 개인정보 우선) → 화면은 '불러오지 못함' 상태. 늦게 온 이전 요청은 버린다.
/** 화면이 세션의 api 를 쓸 때(features 가 app/session 을 직접 import 하지 않게, ARCHITECTURE 2절) */
export function useApi(): Api {
  return useSession().api;
}

export function useFocusLoad<T>(fetch: (api: Api) => Promise<T>, fallback: Message) {
  const {api} = useSession();
  const [info, setInfo] = useState<T | null>(null);
  const [error, setError] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const load = useCallback(() => {
    const mine = ++seq.current;
    setLoading(true);
    fetchRef
      .current(api)
      .then(r => {
        if (mine === seq.current) {
          setInfo(r);
          setError(null);
        }
      })
      .catch(e => {
        if (mine === seq.current) {
          setInfo(null);
          setError(childErrorMessage(e, fallbackRef.current));
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

  return {info, error, loading, load};
}

const summary = (api: Api) => api.fetchChildSummary();
const history = (api: Api) => api.fetchAnswerHistory();
// C5 오류는 한 문장(제목 자리) + 다시 하기
const pastError: Message = {title: copy.child.past.error, body: '', button: copy.child.past.retry};

export const useChildSummary = () => useFocusLoad<ChildSummary>(summary, copy.child.home.error);
export const useAnswerHistory = () => useFocusLoad<ParentHistory[]>(history, pastError);
