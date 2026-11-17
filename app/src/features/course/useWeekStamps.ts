import {useEffect, useState} from 'react';
import {localStamps} from '../../lib/localStamps';
import {kstWeekStart} from './stamps';
import type {Api, WeekStamps} from '../types';

// 이번 주 도장 출처(리드 결정 2026-11-17 "미연결 도장 출처").
// - 연결된 어르신: 서버(my_week_stamps)만. 처음 연결된 상태로 불러올 때 기기 로컬 목록은 지운다(서버로 옮기지 않음).
// - 미연결 기기: 서버에 기록이 없으므로 기기 로컬 목록(lib/localStamps, 날짜만)으로 그린다.
// refreshKey(오늘 마친 단계 수 등)가 바뀌면 다시 읽는다. 실패하면 null(도장 줄만 숨김, 장식이라 코스를 막지 않음).
// undefined = 아직 받는 중.
export function useWeekStamps(api: Api, linked: boolean | undefined, refreshKey: unknown): WeekStamps | null | undefined {
  const [week, setWeek] = useState<WeekStamps | null | undefined>(undefined);
  useEffect(() => {
    if (linked === undefined) {
      return;
    }
    let alive = true;
    const load = linked
      ? localStamps()
          .clear()
          .then(() => api.getWeekStamps())
      : localStamps()
          .read()
          .then(doneDates => ({weekStart: kstWeekStart(), doneDates}));
    load.then(w => alive && setWeek(w)).catch(() => alive && setWeek(null));
    return () => {
      alive = false;
    };
  }, [api, linked, refreshKey]);
  return week;
}
