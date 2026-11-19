import React, {useState} from 'react';
import {View} from 'react-native';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {AudienceProvider, Choice, DsScreen, Heading, Text} from '../../ui/ds';
import {copy, offlineMessage} from '../../copy/copy';
import {isOffline, isServerError, PARENT_TITLES} from '../types';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {track} from '../track';
import {useFoldGap} from '../../ui/ds/useFoldGap';
import {ds} from '../../ui/ds/roles';

const t = copy.relation;

// C1 v4: 호칭 1칸(닫힌 목록 7개, 기본 부모님) → 가족 만들기 → 호칭 저장 → 번호 1개 만들기 → C3 연결 기다리는 중.
// - V9(C3 시안 #42): C2(번호가 만들어졌어요)를 거치지 않고 바로 C3 — C3 가 번호 카드를 맨 위에 둔다. C2 화면은 재연결(설정·끊김 배너)에서만 쓴다
// - 호칭은 ds Choice 2열(디자인 결정 a): 글자 150% 이상이거나 칸 폭에서 줄바꿈되면 저절로 1열. 고른 칸은 ✓ + 굵은 테두리
// - 위 BackLink '처음으로'(로그아웃 확인 없이 역할 선택으로, 감사 M10), Dock = '다음'
export function RelationScreen() {
  const navigation = useNavigation();
  const {api, resetRole} = useSession();
  const [title, setTitle] = useState<string>('부모님');
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [failed, setFailed] = useState<string | null>(null);
  // R-15: 1열(200%)로 넘치면 첫 화면 끝에 걸친 줄을 통째로 아래로(+ DsScreen '더 있음' 띠). 2열이면 두 칸 한 줄 단위
  const fold = useFoldGap(PARENT_TITLES.length, ds.touch.elder.gap);

  const next = async () => {
    if (!beginBusy()) {
      return;
    }
    setFailed(null);
    try {
      try {
        await api.createFamily();
      } catch (e) {
        // 다시 누른 경우(이미 가족이 있음)는 그대로 이어 간다
        if (!isServerError(e, 'already_has_profile')) {
          throw e;
        }
      }
      const r = await api.setParentTitle(title);
      if (!r.ok) {
        // 리뷰 D-L1: 0035부터 가족 기본 호칭도 다른 어르신과 겹치면 duplicate_title → 일반 오류가 아니라 호칭 중복 안내
        if (r.reason === 'duplicate_title') {
          setFailed(copy.relation.name_taken);
          return;
        }
        throw new Error('invalid_title');
      }
      // 살아 있는 가입 번호가 있으면 다시 쓴다(새로 받으면 이미 보낸 번호가 무효가 된다, 서버 0018). 호칭은 위에서 갱신됨
      const s = await api.getChildState();
      const reuse = s.kind === 'family' && s.code ? s.code.code : null;
      if (!reuse) {
        await api.issueInviteCode();
        track(api, 'invite_code_issued', {purpose: 'parent_code'}); // AC-05: 새로 받은 때만(다시 쓰는 번호는 세지 않음)
      }
      // C3 로 바로(스택에 C1 이 남지 않게). 번호 보내기·복사(invite_share_tapped)는 C3 가 잰다
      navigation.dispatch(
        CommonActions.reset({index: 0, routes: [{name: 'Wait'}]}),
      );
    } catch (e) {
      setFailed(isOffline(e) ? offlineMessage.title : t.failed);
    } finally {
      endBusy();
    }
  };

  return (
    <AudienceProvider value="child">
      <DsScreen
        variant="form"
        back={{label: copy.login.back, onPress: resetRole}}
        header={
          <>
            <Heading level={1}>{t.title}</Heading>
            <Text role="bodyLg">{t.hint}</Text>
          </>
        }
        onViewport={fold.onViewport}
        dock={{primary: {label: t.next, onPress: next, loading: busy}}}
      >
        <View onLayout={fold.onBlock}>
          <Choice
            mode="radio"
            columns={2}
            testID="title-group"
            accessibilityLabel={t.title}
            items={PARENT_TITLES.map(p => ({key: p, label: p}))}
            value={title}
            onSelect={setTitle}
            onItemHeights={fold.onHeights}
            push={fold.push}
          />
        </View>
        <Text role="sub" tone="muted">
          {t.fallback}
        </Text>
        <Text role="sub" tone="muted">
          {t.later}
        </Text>
        <View accessibilityLiveRegion="polite">
          {failed ? (
            <Text role="body" tone="danger">
              {failed}
            </Text>
          ) : null}
        </View>
      </DsScreen>
    </AudienceProvider>
  );
}
