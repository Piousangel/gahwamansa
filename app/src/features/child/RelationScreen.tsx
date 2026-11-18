import React, {useState} from 'react';
import {View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {SelectCard} from '../../ui/SelectCard';
import {copy, offlineMessage} from '../../copy/copy';
import {isOffline, isServerError, PARENT_TITLES} from '../types';
import {useBusyLatch} from '../../ui/useBusyLatch';

const t = copy.relation;

// C1: 호칭 1칸(닫힌 목록 7개, 기본 부모님) -> 가족 만들기 -> 호칭 저장 -> 번호 1개 만들기
export function RelationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ChildParams>>();
  const {api} = useSession();
  const [title, setTitle] = useState<string>('부모님');
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [failed, setFailed] = useState<string | null>(null);

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
      const code = s.kind === 'family' && s.code ? s.code.code : await api.issueInviteCode();
      navigation.replace('Code', {code, title, renewed: s.kind === 'family' && !s.code && s.hadExpired, expiresAt: s.kind === 'family' && s.code ? s.code.expiresAt : undefined});
    } catch (e) {
      setFailed(isOffline(e) ? offlineMessage.title : t.failed);
    } finally {
      endBusy();
    }
  };

  return (
    <Screen top={<BackBar />} bottom={<BigButton label={t.next} disabled={busy} onPress={next} />}>
      <Text20 size={28} weight="bold">{t.title}</Text20>
      <Text20>{t.hint}</Text20>
      {/* 선택 카드 묶음은 라디오 그룹(talkback-spec R9) */}
      <View testID="title-group" accessibilityRole="radiogroup">
        {PARENT_TITLES.map(p => (
          <SelectCard key={p} label={p} selected={title === p} onPress={() => setTitle(p)} />
        ))}
      </View>
      <Text20>{t.fallback}</Text20>
      <Text20>{t.later}</Text20>
      {failed ? <Text20 accessibilityLiveRegion="polite">{failed}</Text20> : null}
    </Screen>
  );
}
