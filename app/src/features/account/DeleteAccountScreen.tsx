import React, {useEffect, useState} from 'react';
import {StyleSheet, TextInput, View} from 'react-native';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, FONT_SCALE_MAX_BODY, radius} from '../../ui/tokens';
import {appCopy, copy, withTitle, Message} from '../../copy/copy';
import type {DeleteScope} from '../types';
import {clearAccountKeys} from '../../lib/accountStore';
import {defaultStore} from '../../lib/kvStore';
import {errorMessage} from '../course/useFinishStep';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {prefs} from '../../lib/prefs';

type Props = {role: 'parent' | 'child'};

// 단계별 경고. "그만둘래요"가 주 버튼. 어르신: 확인 1번(설정의 모두 지우기가 앞 단계). 자녀: 계정 지우기 -> (마지막 자녀면 '지우기' 입력) -> 계정 지우기.
export function DeleteAccountScreen({role}: Props) {
  const navigation = useNavigation();
  const {api, clear} = useSession();
  const [stage, setStage] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [failed, setFailed] = useState<Message | null>(null);
  const child = role === 'child';
  const dp = copy.delete.parent;
  const dc = copy.delete.child;

  // 삭제 범위 사전 조회. 실패하면 가장 강한 경고(family)로 대체한다(보수적).
  const [scope, setScope] = useState<DeleteScope | null>(null);
  const [title, setTitle] = useState('부모님');
  useEffect(() => {
    let alive = true;
    api
      .deleteScopePreview()
      .then(r => alive && setScope(r.scope))
      .catch(() => alive && setScope('family'));
    if (child) {
      api
        .fetchChildSummary()
        .then(s => alive && setTitle(s.parentTitle))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [api, child]);
  const strong = child && scope === 'family';

  const run = async () => {
    if (!beginBusy()) {
      return;
    }
    setFailed(null);
    const tag = await api.accountTag().catch(() => null); // 지운 뒤에는 세션이 없어 먼저 받아 둔다
    try {
      const r = await api.deleteMyAccount().finally(() => clearAccountKeys(defaultStore(), tag)); // 재검토 R2: 삭제 뒤 signOut 이 실패해도 정리
      clear();
      prefs().resetFirstGreeting(); // 같은 기기에서 다시 연결하는 계정은 해님 첫 인사를 다시 받는다(리뷰 l2 L3)
      navigation.dispatch(
        CommonActions.reset({index: 0, routes: [{name: 'DeleteDone', params: {scope: r.scope, role, title}}]}),
      );
    } catch (e) {
      setFailed(errorMessage(e));
    } finally {
      endBusy();
    }
  };

  const confirmEnabled = !busy && (!strong || typed.trim() === dc.type_word);

  // 표준 화면 틀: 경고 내용은 본문(스크롤), 안전한 "그만둘래요"(주)와 위험 외곽선 버튼은 하단 고정.
  // 실패하면 하단에 오류 패널 + "다시 하기"(위험 외곽선, 같은 지우기를 다시 시도)를 둔다.
  const dangerButton = !child ? (
    // 어르신: 설정의 "모두 지우기"가 첫 단계라 여기서는 한 번만 확인한다(2차 확정 P9)
    <BigButton variant="danger" label={dp.yes} loading={busy} onPress={run} />
  ) : stage === 1 ? (
    <BigButton variant="danger" label={dc.danger} disabled={scope === null} onPress={() => setStage(2)} />
  ) : (
    <BigButton variant="danger" label={dc.danger} disabled={!confirmEnabled} loading={busy} onPress={run} />
  );
  const dock = (
    <>
      {failed ? (
        <View style={styles.fail} accessibilityLiveRegion="polite">
          <Text20 size={24} weight="bold" style={styles.failTitle}>{child ? dc.fail : dp.fail_title}</Text20>
          {child ? null : <Text20>{dp.fail_body}</Text20>}
        </View>
      ) : null}
      <BigButton label={child ? dc.cancel : dp.cancel} onPress={() => navigation.goBack()} />
      {failed ? <BigButton variant="danger" label={failed.button} loading={busy} onPress={run} /> : dangerButton}
    </>
  );

  return (
    <Screen top={<BackBar />} bottom={dock}>
      {child && scope === null ? (
        <Text20>{appCopy.loading}</Text20>
      ) : child ? (
        <>
          {strong ? (
            <View style={styles.box}>
              <Text20 size={24} weight="bold" style={styles.dangerText}>{withTitle(dc.last_title, title)}</Text20>
              <Text20 size={24} weight="bold">{withTitle(dc.last_body, title)}</Text20>
            </View>
          ) : (
            <>
              <Text20 size={24} weight="bold">{dc.keep_title}</Text20>
              <Text20>{withTitle(dc.keep_body, title)}</Text20>
            </>
          )}
          <Text20 weight="bold">{dc.warn_label}</Text20>
        </>
      ) : (
        <>
          <Text20 size={28} weight="bold" accessibilityRole="header">{dp.title}</Text20>
          <Text20 size={24}>{dp.body}</Text20>
        </>
      )}

      {stage === 2 && strong ? (
        <>
          <Text20>{dc.type_hint}</Text20>
          <TextInput
            accessibilityLabel="확인 글자 입력"
            value={typed}
            onChangeText={setTyped}
            maxFontSizeMultiplier={FONT_SCALE_MAX_BODY}
            style={styles.input}
          />
        </>
      ) : null}
    </Screen>
  );
}

// 위험 박스(명세 §8 danger): 색만이 아니라 굵은 외곽선 + 굵은 제목 문구로 구분
const styles = StyleSheet.create({
  box: {borderWidth: 4, borderColor: color.dangerInk, backgroundColor: color.dangerSoft, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 16, gap: 8},
  dangerText: {color: color.dangerInk},
  fail: {borderWidth: 3, borderColor: color.dangerInk, backgroundColor: color.dangerSoft, borderRadius: radius.card, paddingVertical: 10, paddingHorizontal: 16, gap: 4},
  failTitle: {color: color.dangerInk},
  input: {minHeight: 64, fontSize: 24, borderWidth: 3, borderColor: color.line, borderRadius: radius.input, backgroundColor: color.card, paddingHorizontal: 16, color: color.ink},
});
