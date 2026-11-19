import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {BackBar} from '../../app/BackBar';
import {DsScreen, Field, Heading, StateView, Text, type ButtonHandle} from '../../ui/ds';
import type {ScreenScroll} from '../../ui/Screen';
import {ds} from '../../ui/ds/roles';
import {appCopy, copy, withTitle, Message} from '../../copy/copy';
import {isServerError, type DeleteScope} from '../types';
import {clearAccountKeys} from '../../lib/accountStore';
import {defaultStore} from '../../lib/kvStore';
import {errorMessage} from '../course/useFinishStep';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {prefs} from '../../lib/prefs';
import {Dialog} from '../../ui/Dialog';

type Props = {role: 'parent' | 'child'};

// 계정 지우기(어르신 P9·자녀 C8 공용). v4(시안 없음, 토큰 효과만): 배치는 그대로, 부품만 ui/ds.
// 단계: 어르신 = 이 화면(1단계) → 확인 상자 '정말 모두 지울까요? / 되돌릴 수 없어요'(2단계, DECISIONS 153·감사 H1, 상자는 ui/Dialog 그대로 — ds 에 Dialog 없음).
//       자녀 = 계정 지우기 → (마지막 자녀면 '지우기' 입력) → 계정 지우기.
// Dock: 주 = 안전한 '안 지울래요'(#134 닫기 말 — 질문의 거절), 보조 = 위험 외곽선(ds Button danger). 실패하면 본문 맨 위에 위험 상자 + 보조가 '다시 하기'.
// 측정: account_deleted 는 서버(삭제 RPC)가 기록한다 — 이 화면은 api.deleteMyAccount 만 부른다(바꾸지 않음).
// audience: 자녀는 자녀 스택 루트, 어르신은 기본(elder).
export function DeleteAccountScreen({role}: Props) {
  const navigation = useNavigation();
  const {api, clear} = useSession();
  const [stage, setStage] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [failed, setFailed] = useState<Message | null>(null);
  const [confirm2, setConfirm2] = useState(false); // 어르신 2단계 확인 상자
  const yesRef = useRef<ButtonHandle>(null);
  const child = role === 'child';
  const dp = copy.delete.parent;
  const dc = copy.delete.child;
  const so = copy.delete.signed_out;

  // 삭제 범위 사전 조회. 실패하면 가장 강한 경고(family)로 대체한다(보수적).
  const [scope, setScope] = useState<DeleteScope | null>(null);
  const [title, setTitle] = useState('부모님');
  useEffect(() => {
    let alive = true;
    const loadTitle = () => {
      if (child) {
        api
          .fetchChildSummary()
          .then(x => alive && setTitle(x.parentTitle))
          .catch(() => {});
      }
    };
    api
      .deleteScopePreview()
      .then(r => {
        if (!alive) {
          return;
        }
        setScope(r.scope);
        // 호칭은 가족이 있을 때만 쓴다(0049 'none' = 가족 연결 전이면 묻지 않는다, PR1 리뷰 M2)
        if (r.scope !== 'none') {
          loadTitle();
        }
      })
      .catch(() => {
        if (alive) {
          setScope('family'); // 범위를 모르면 가장 강한 경고
          loadTitle();
        }
      });
    return () => {
      alive = false;
    };
  }, [api, child]);
  const strong = child && scope === 'family';

  // 서버에서 지워졌는데 응답만 끊긴 경우는 세션이 남아 있어, 다시 하기에 0049 가 {scope:'none'} 성공을 준다(따로 처리할 것 없음).
  // 'no_profile'(0049: auth.uid() 없음 = 로그인 정보가 없음)은 지우지 못한 것 — '지웠어요'로 보이면 거짓 안내(#146 리뷰 H1).
  // 그래서 언제든 별도 안내('로그인이 풀려 지워지지 않았어요') + 다시 로그인 경로. 지운 뒤 화면 문구는 서버가 돌려준 scope 만 쓴다.
  const [signedOut, setSignedOut] = useState(false);
  const scrollRef = useRef<ScreenScroll>(null);
  // L4: 실패 상자는 본문 맨 위라, 나타나면 본문을 맨 위로(아래로 스크롤한 채 '다시 하기'를 눌러도 보이게)
  useEffect(() => {
    if (failed) {
      scrollRef.current?.showRange(0, 1);
    }
  }, [failed]);
  const done = (s: DeleteScope) => {
    clear();
    prefs().resetFirstGreeting(); // 같은 기기에서 다시 연결하는 계정은 해님 첫 인사를 다시 받는다(리뷰 l2 L3)
    navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'DeleteDone', params: {scope: s, role, title}}]}));
  };

  const run = async () => {
    if (!beginBusy()) {
      return;
    }
    setFailed(null);
    setSignedOut(false);
    const tag = await api.accountTag().catch(() => null); // 지운 뒤에는 세션이 없어 먼저 받아 둔다
    try {
      const r = await api.deleteMyAccount().finally(() => clearAccountKeys(defaultStore(), tag)); // 재검토 R2: 삭제 뒤 signOut 이 실패해도 정리
      done(r.scope);
    } catch (e) {
      if (isServerError(e, 'no_profile')) {
        setSignedOut(true);
        setFailed({title: so.title, body: so.body, button: so.button});
        return;
      }
      setFailed(errorMessage(e));
    } finally {
      endBusy();
    }
  };

  const confirmEnabled = !busy && (!strong || typed.trim() === dc.type_word);

  // 위험 보조 버튼: 어르신은 이 화면이 1단계라 누르면 2단계 상자(되돌릴 수 없어요는 상자에서 한 번만, copy 11절 ⑥). 지우기는 상자 안에서만
  // 로그인이 풀렸으면 다시 하기가 아니라 다시 로그인(자녀 = 로그인, 어르신 = 번호 입력). 이 기기 세션 정리 후 이동
  const relogin = () => {
    clear();
    navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: child ? 'Login' : 'Connect'}]}));
  };
  const danger = signedOut && failed
    ? {label: failed.button, onPress: relogin}
    : failed
    ? {label: failed.button, onPress: run, loading: busy, buttonRef: child ? undefined : yesRef} // L1: 다시 하기도 같은 자리라 포커스 되돌림 ref 유지
    : !child
      ? {label: dp.yes, onPress: () => setConfirm2(true), loading: busy, buttonRef: yesRef}
      : stage === 1
        ? {label: dc.danger, onPress: () => setStage(2), disabled: scope === null}
        : {label: dc.danger, onPress: run, disabled: !confirmEnabled, loading: busy};

  const heading = !child
    ? dp.title
    : scope === null
      ? null
      : scope === 'none'
        ? copy.child.delete_none.title // 0049: 가족 연결 전 계정 — '{호칭}의 기록은 남아요'는 틀린 안내라 쓰지 않는다
        : strong
          ? null // 마지막 자녀: 제목 대신 위험 상자가 머리글
          : dc.keep_title;

  return (
    <DsScreen
      variant="form"
      scrollRef={scrollRef}
      header={
        <>
          <BackBar />
          {heading ? <Heading level={1}>{heading}</Heading> : null}
        </>
      }
      dock={{
        primary: {label: child ? dc.cancel : dp.cancel, onPress: () => navigation.goBack()},
        secondary: {kind: 'danger', ...danger},
      }}>
      {failed ? (
        // 실패 상자: 색만이 아니라 굵은 외곽선 + 머리글 문구로 구분(명세 §8 danger). 나타날 때 한 번 읽는다
        <View style={styles.box} accessibilityLiveRegion="polite" testID="delete-fail">
          <Text role="heading" tone="danger">
            {signedOut ? so.title : child ? dc.fail : dp.fail_title}
          </Text>
          {signedOut ? <Text role="body">{so.body}</Text> : child ? null : <Text role="body">{dp.fail_body}</Text>}
        </View>
      ) : null}
      {!child ? (
        <Text role="bodyLg">{dp.step1_body}</Text>
      ) : scope === null ? (
        <StateView kind="loading" title={appCopy.loading} />
      ) : (
        <>
          {scope === 'none' ? (
            <Text role="bodyLg" testID="delete-none-body">
              {copy.child.delete_none.body}
            </Text>
          ) : strong ? (
            <View style={styles.box}>
              <Text role="heading" tone="danger" accessibilityRole="header">
                {withTitle(dc.last_title, title)}
              </Text>
              <Text role="bodyLg">{withTitle(dc.last_body, title)}</Text>
            </View>
          ) : (
            <Text role="bodyLg">{withTitle(dc.keep_body, title)}</Text>
          )}
          <Text role="heading" tone="danger">
            {dc.warn_label}
          </Text>
        </>
      )}

      {stage === 2 && strong ? <Field label={dc.type_hint} value={typed} onChangeText={setTyped} testID="delete-type" /> : null}
      {child ? null : (
        <Dialog
          visible={confirm2}
          title={dp.step2_title}
          warningLabel={dp.step2_body}
          actions={[
            {label: dp.cancel, onPress: () => setConfirm2(false)},
            {
              label: dp.yes,
              kind: 'danger',
              onPress: () => {
                setConfirm2(false);
                run();
              },
            },
          ]}
          onBack={() => setConfirm2(false)}
          returnFocusRef={yesRef}
          testID="delete-confirm2"
        />
      )}
    </DsScreen>
  );
}

const styles = StyleSheet.create({
  // 위험 상자: dangerSoft 면 + dangerInk 굵은 외곽선(색만으로 알리지 않음 — 머리글 문구와 함께)
  box: {borderWidth: 3, borderColor: ds.color.dangerInk, backgroundColor: ds.color.dangerSoft, borderRadius: ds.radius.card, paddingVertical: 14, paddingHorizontal: 16, gap: 8, alignSelf: 'stretch'},
});
