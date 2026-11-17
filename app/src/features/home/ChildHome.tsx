import React from 'react';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {appCopy, copy} from '../../copy/copy';
import {useChildSummary} from './useChildSummary';
import {useBootLoading} from '../../app/splash';
import {formatAnswerDate} from './formatDate';

export function ChildHome() {
  const {info, error, loading, load} = useChildSummary();
  useBootLoading(loading && !info && !error); // 앱 시작 중이면 스플래시 대기 화면이 덮는다

  // 받은 답이 없을 때만 오류 화면. 이미 받은 답이 있으면 그대로 두고 오류 줄만 덧붙인다.
  if (error && !info) {
    return (
      <Screen>
        <Text20 size={24} weight="bold">{error.title}</Text20>
        <Text20>{error.body}</Text20>
        <BigButton variant="secondary" label={error.button} onPress={load} />
      </Screen>
    );
  }
  const c = copy.child;
  return (
    <Screen>
      <Text20 size={24} weight="bold">{`${info?.parentTitle ?? '부모님'}${c.title_suffix}`}</Text20>
      {error ? (
        <>
          <Text20 weight="bold">{error.title}</Text20>
          <BigButton variant="secondary" label={error.button} onPress={load} />
        </>
      ) : null}
      {loading && !info ? (
        <Text20>{appCopy.loading}</Text20>
      ) : info && !info.shared ? (
        <Text20>{c.not_shared}</Text20>
      ) : info?.latest ? (
        <>
          <Text20 size={36} weight="bold">{info.latest.choiceLabel}</Text20>
          <Text20>{formatAnswerDate(info.latest.answeredDate)}</Text20>
          <Text20 size={24}>{`${info.latest.choiceLabel}${c.talk}`}</Text20>
        </>
      ) : (
        <Text20>{c.no_answer}</Text20>
      )}
    </Screen>
  );
}
