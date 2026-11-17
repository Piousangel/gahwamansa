import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSession} from '../../app/session';
import type {Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';
import type {ChildSummary} from '../types';

// 자녀 화면(앨범·지난 답)이 함께 쓰는 요약 조회. 화면에 들어올 때·앱으로 돌아올 때 다시 불러온다.
// 조회 실패는 '답 없음'이 아니라 오류로 따로 알린다(이전 값은 유지).
export function useChildSummary() {
  const {api} = useSession();
  const [info, setInfo] = useState<ChildSummary | null>(null);
  const [error, setError] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

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

  return {info, error, loading, load};
}
