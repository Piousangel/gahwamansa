import React, {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {TopBar} from '../../ui/TopBar';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {BottomSheet} from '../../shared/u0Overlays';
import {useToast} from '../../shared/u0Overlays';
import {appCopy, copy, withTitle} from '../../copy/copy';
import {color, radius, size} from '../../ui/tokens';
import {CHILD_CHEER_KEYS, CheerKey, ChildParent, ChildSummary, isOffline, SendCheerResult} from '../types';
import {useChildSummary} from '../../shared/useChildData';
import {useBootLoading} from '../../app/splash';
import {formatAnswerDate} from './formatDate';
import {childErrorMessage} from '../../shared/childError';

const c = copy.child;
const h = c.home;

// 화면에 보일 어르신 목록. 옛 서버(parents 비어 있음)면 가족 호칭 한 명으로 본다.
function cards(info: ChildSummary): ChildParent[] {
  return info.parents.length
    ? info.parents
    : [{parentId: '', title: info.parentTitle, shared: info.shared, connected: true, latest: info.latest, starter: null}];
}

// C4 자녀 홈 v3: 상단 바(우리 집 앨범·설정) + 최근 답 카드(어르신별) + 연결 끊김 배너 + 하단 응원 보내기.
// 칩·연속일·참여·완료 여부 없음. 연결이 풀린 어르신만 있으면 응원 버튼을 뺀다.
export function ChildHome() {
  const navigation = useNavigation<NativeStackNavigationProp<ChildParams>>();
  const {api} = useSession();
  const {info, error, loading, load} = useChildSummary();
  const [sheet, setSheet] = useState(false);
  const [sending, setSending] = useState(false);
  const [making, setMaking] = useState(false);
  const {toast, show} = useToast();
  useBootLoading(loading && !info && !error); // 앱 시작 중이면 스플래시 대기 화면이 덮는다

  const list = info ? cards(info) : [];
  const many = list.length > 1;
  const reachable = list.filter(p => p.connected && p.parentId); // 옛 서버(parent_id 없음)면 보낼 대상이 없다

  // 연결된 어르신 한 분씩 보낸다(send_cheer 는 어르신 한 분 대상). 받은 분의 호칭으로 "{호칭}께 보냈어요".
  const send = async (key: CheerKey) => {
    if (sending) {
      return;
    }
    setSheet(false);
    setSending(true);
    const sentTo: string[] = [];
    let failed: SendCheerResult | null = null;
    try {
      for (const p of reachable) {
        const r = await api.sendCheer(p.parentId, key);
        if (r.ok) {
          sentTo.push(p.title);
        } else {
          failed = r;
        }
      }
      if (sentTo.length) {
        show(withTitle(c.cheer.sent, sentTo.join('·')));
      } else {
        // TODO(라이터): daily_limit·disconnected 전용 문구가 없어 일반 오류 제목을 쓴다
        show(copy.errors.server.title);
      }
      if (failed && !failed.ok && (failed.reason === 'disconnected' || failed.reason === 'invalid_target')) {
        load(); // 연결 상태가 바뀌었다 → 배너·버튼을 서버 기준으로
      }
    } catch (e) {
      show(isOffline(e) ? copy.errors.offline.title : copy.errors.server.title);
    } finally {
      setSending(false);
    }
  };

  const makeCode = async (p: ChildParent) => {
    if (making) {
      return;
    }
    setMaking(true);
    try {
      const code = await api.issueInviteCode(p.parentId || null);
      navigation.navigate('Code', {code, title: p.title});
    } catch (e) {
      show(childErrorMessage(e, h.error).title);
    } finally {
      setMaking(false);
    }
  };

  const top = <TopBar title={h.bar_title} settingsLabel={copy.settings.open} onSettings={() => navigation.navigate('Settings')} />;

  // 받은 요약이 없을 때만 오류 화면. 이미 받은 것이 있으면 그대로 두고 오류 줄만 덧붙인다.
  if (error && !info) {
    return (
      <Screen top={top}>
        <View testID="child-home-error" style={styles.center}>
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
          <BigButton variant="secondary" label={error.button} onPress={load} />
        </View>
      </Screen>
    );
  }

  const bottom =
    !info ? (
      <BigButton label={c.cheer.button} disabled disabledReason={h.loading_reason} onPress={() => {}} />
    ) : reachable.length ? (
      <BigButton label={c.cheer.button} loading={sending} onPress={() => setSheet(true)} />
    ) : undefined;

  return (
    <View style={styles.flex}>
      <Screen top={top} bottom={bottom}>
        {error ? <Text20 weight="bold" accessibilityLiveRegion="polite">{error.title}</Text20> : null}
        {!info ? (
          <Text20>{appCopy.loading}</Text20>
        ) : (
          <>
            {list
              .filter(p => !p.connected)
              .map(p => (
                <View key={`off-${p.parentId}`} testID="child-home-disconnected" style={styles.banner} accessibilityLiveRegion="polite">
                  <Text20 size={24} weight="bold">{withTitle(h.disconnected.title, p.title)}</Text20>
                  <Text20>{h.disconnected.body}</Text20>
                  <BigButton variant="secondary" label={h.disconnected.button} loading={making} onPress={() => makeCode(p)} />
                </View>
              ))}
            {list.map(p => (
              <AnswerCard key={`card-${p.parentId}`} parent={p} withHeader={many} />
            ))}
          </>
        )}
      </Screen>
      <BottomSheet visible={sheet} onClose={() => setSheet(false)} closeLabel={c.cheer.close} title={c.cheer.title} hint={c.cheer.hint}>
        {CHILD_CHEER_KEYS.map(k => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={copy.cheers[k]}
            onPress={() => send(k)}
            style={({pressed}) => [styles.option, pressed ? styles.optionPressed : null]}>
            <Text20 size={22}>{copy.cheers[k]}</Text20>
          </Pressable>
        ))}
      </BottomSheet>
      {toast}
    </View>
  );
}

// 최근 답 카드(폴라로이드형 테이프 1곳 + 스티치 1줄). 어르신이 여럿이면 빈·나누지 않음 상태에도 호칭 머리를 단다.
function AnswerCard({parent: p, withHeader}: {parent: ChildParent; withHeader: boolean}) {
  const head = `${p.title}${c.title_suffix}`;
  if (!p.shared || !p.latest) {
    return (
      <View style={withHeader ? styles.card : styles.plain}>
        {withHeader ? <Text20 weight="bold" style={styles.sub}>{head}</Text20> : null}
        <Text20 style={styles.centerText}>{!p.shared ? c.not_shared : c.no_answer}</Text20>
      </View>
    );
  }
  const today = formatAnswerDate(p.latest.answeredDate) === '오늘';
  return (
    <View testID="child-home-card" style={styles.card}>
      <View style={styles.tape} />
      <Text20 weight="bold" style={styles.sub}>{head}</Text20>
      <Text20 size={72} weight="bold" style={styles.choice}>{p.latest.choiceLabel}</Text20>
      <Text20>{formatAnswerDate(p.latest.answeredDate)}</Text20>
      <View style={styles.stitch} />
      <Text20 size={24}>{today ? `${p.latest.choiceLabel}${c.talk}` : h.talk_old}</Text20>
      {p.starter ? (
        // 기능 회의 B3: 구분선 아래 명사형 표지 + 한 문장. 값이 없으면 줄 전체를 숨긴다
        <View testID="child-home-starter" style={styles.starter}>
          <View style={styles.stitch} />
          <Text20 weight="bold" style={styles.sub}>{h.starter_label}</Text20>
          <Text20>{p.starter}</Text20>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  center: {alignItems: 'center', gap: 8, paddingTop: 48},
  centerText: {textAlign: 'center'},
  plain: {paddingVertical: 32, alignItems: 'center', gap: 8},
  banner: {backgroundColor: color.noticeSoft, borderRadius: radius.card, padding: 16, gap: 6},
  card: {backgroundColor: color.card, borderRadius: radius.childCard, padding: 20, paddingTop: 28, gap: 6, marginTop: 8},
  tape: {position: 'absolute', top: -10, alignSelf: 'center', width: 96, height: 24, backgroundColor: color.tape, transform: [{rotate: '-3deg'}]},
  stitch: {borderTopWidth: 2, borderStyle: 'dashed', borderColor: color.lineSoft, marginVertical: 8},
  choice: {color: color.inkTitle},
  starter: {gap: 4},
  sub: {color: color.inkSub},
  option: {
    minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: color.card, borderRadius: radius.select, borderWidth: 3, borderColor: color.lineSoft,
  },
  optionPressed: {backgroundColor: color.actionSoft, borderColor: color.action},
});
