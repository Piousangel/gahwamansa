import React, {useEffect, useState} from 'react';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {copy} from '../../copy/copy';

export function ChildHome() {
  const {api} = useSession();
  const [info, setInfo] = useState<{participatedToday: boolean; streak: number} | null>(null);
  useEffect(() => {
    api.fetchChildHome().then(setInfo).catch(() => setInfo(null));
  }, [api]);
  return (
    <Screen>
      <Text20 size={24} weight="bold">오늘 참여 여부</Text20>
      <Text20>{info?.participatedToday ? '오늘 참여하셨어요' : '오늘은 아직이에요'}</Text20>
      <Text20>{`연속 ${info?.streak ?? 0}일`}</Text20>
      <Text20 size={24} weight="bold">응원 한마디</Text20>
      <Text20>{copy.cheers.well_done}</Text20>
    </Screen>
  );
}
