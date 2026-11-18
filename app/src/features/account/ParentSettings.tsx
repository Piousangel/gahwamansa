import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Switch, useWindowDimensions, View} from 'react-native';
import {prefs} from '../../lib/prefs';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen, type ScreenScroll} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {SettingsGroup, SettingsRow} from '../../ui/SettingsRow';
import {color, radius, shadow, size} from '../../ui/tokens';
import {appCopy, CONSENT_VERSION, copy, Message} from '../../copy/copy';
import {pairShort} from '../../lib/childFormat';
import type {HistoryDay} from '../../api/contract/history';
import {errorMessage} from '../course/useFinishStep';
import {APP_VERSION} from '../../lib/appInfo';
import {useAppVersionTaps} from '../../dev/devGate';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {NotifyRows} from './NotifyRows';
import {AppInfoRows} from './AppInfoRows';
import {bgmAsset} from '../../lib/bgmAsset';

const t = copy.settings;
type Confirm = 'none' | 'stop' | 'resume';

// 어르신 설정(P13): 가족에게 답 보여 주기(그만 보여 주기 / 다시 보여 주기, 각각 확인 1단계), 모두 지우기.
export function ParentSettings() {
  const navigation = useNavigation<NativeStackNavigationProp<ParentParams>>();
  const route = useRoute<RouteProp<ParentParams, 'Settings'>>();
  const {api, consented, setConsented, content} = useSession();
  const linked = !!content?.linked; // 미연결 열람(번호 전)에는 보여 주기·지우기 대신 번호 쓰기 안내(QA B3)
  // 디자인 W0 ③: P3 띠 '다시 정하기'로 오면 '다시 보여 주기' 확인을 펼친 채로 연다(포커스는 확인 제목)
  const fromDeclined = route.params?.expand === 'resume' && !consented && linked;
  const [confirm, setConfirm] = useState<Confirm>(fromDeclined ? 'resume' : 'none');
  const resumeTitleRef = useRef<React.ComponentRef<typeof View>>(null);
  // 감사 M3: 확인 패널이 열리면 패널 끝(실행 버튼)까지 보이게 본문을 스크롤한다(하단 고정 '돌아가기'에 가려지지 않게)
  const scroll = useRef<ScreenScroll>(null);
  const showPanel = (e: {nativeEvent: {layout: {y: number; height: number}}}) => {
    const {y, height} = e.nativeEvent.layout;
    scroll.current?.showRange(y, y + height);
  };
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [error, setError] = useState<Message | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const versionTap = useAppVersionTaps();

  const run = async (action: () => Promise<void>, next: boolean, done: string | null) => {
    if (!beginBusy()) {
      return;
    }
    setError(null);
    try {
      await action();
      setConsented(next);
      setConfirm('none');
      setNotice(done);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      endBusy();
    }
  };

  // 표준 화면 틀: 설정 내용은 본문(스크롤), "돌아가기"만 하단 고정.
  return (
    <Screen
      scrollRef={scroll}
      initialFocusRef={fromDeclined ? resumeTitleRef : undefined} // '다시 정하기'로 왔으면 첫 포커스는 확인 제목(화면 제목 대신, 순서 보장)
      top={
        <>
          <BackBar />
          <Text20 size={32} weight="bold" accessibilityRole="header" style={styles.title}>
            {copy.settings.open}
          </Text20>
        </>
      }
      bottom={<BigButton variant="secondary" label={t.back} onPress={() => navigation.goBack()} />}>
      {/* 행 목록(시안 P13_more v2, UX U8): 구역 가족 → 알림과 소리 → 앱, 위험 행(모두 지우기)은 맨 아래 */}
      <SettingsGroup title={t.group_family} />
      {linked ? (
        <>
          <Text20 style={styles.sub}>{t.share_scope}</Text20>
          {/* 디자인 W0 ②: '›' 없음, 오른쪽 동사 버튼(64) → 행 아래 확인 펼침(expanded). 200%면 버튼이 다음 줄 전체 폭 */}
          <ShareRow
            consented={consented}
            expanded={confirm !== 'none'}
            onPress={() => setConfirm(confirm !== 'none' ? 'none' : consented ? 'stop' : 'resume')}
          />
          {notice ? <Text20 accessibilityLiveRegion="polite">{notice}</Text20> : null}
          {confirm === 'stop' ? (
            <View testID="settings-confirm" style={styles.confirm} onLayout={showPanel}>
              <Text20 size={26} weight="bold">{t.stop_title}</Text20>
              <Text20>{t.stop_body}</Text20>
              <BigButton label={t.keep} onPress={() => setConfirm('none')} />
              <BigButton variant="secondary" label={t.stop} loading={busy} onPress={() => run(() => api.withdrawConsent(), false, t.stopped)} />
            </View>
          ) : confirm === 'resume' ? (
            <View testID="settings-confirm" style={styles.confirm} onLayout={showPanel}>
              <View ref={resumeTitleRef} accessible accessibilityRole="header" accessibilityLabel={t.resume_confirm}>
                <Text20 size={26} weight="bold">{t.resume_confirm}</Text20>
              </View>
              <BigButton label={t.resume_yes} loading={busy} onPress={() => run(() => api.giveConsent(CONSENT_VERSION), true, null)} />
              <BigButton variant="secondary" label={t.keep} onPress={() => setConfirm('none')} />
            </View>
          ) : null}
          {error ? (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Text20 size={24} weight="bold" style={styles.errorTitle}>{error.title}</Text20>
              <Text20>{error.body}</Text20>
            </View>
          ) : null}
          {/* P16 연결된 가족(copy 11-3 settings.family_row): 누구와 연결됐는지 확인·그만두기 */}
          {/* AP-06 시안 P13_more: '답 보여 주기' 바로 아래 '가족에게 이렇게 보여요' › (펼친 확인·오류 줄이 있으면 그 아래) */}
          <SettingsRow testID="settings-row-preview" title={copy.settings.preview.title} onPress={() => navigation.navigate('FamilyPreview')} />
          <SettingsRow testID="settings-row-family" title={t.family_row} onPress={() => navigation.navigate('Family')} />
        </>
      ) : (
        <View style={styles.section}>
          <Text20 size={24} weight="bold">{t.share_row}</Text20>
          <Text20>{copy.course.disconnected_banner}</Text20>
          <BigButton variant="secondary" label={copy.course.write_code} onPress={() => navigation.push('Connect', {from: 'course'})} />
        </View>
      )}
      <SettingsGroup title={t.group_sound} />
      {/* 알림 행(AU-04 뒤 법률 규칙 ③): 연결된 어르신만. 켬/끔 = set_push_enabled */}
      {linked ? <NotifyRows /> : null}
      {bgmAsset() !== null ? <BgmRow /> : null}
      <SfxRow />
      <SettingsGroup title={t.group_app} />
      {/* 앱 정보 한 목록(법률 in-app-notices §3, AP-06): 약관·방침(앱 안 웹)·오픈소스·AI·병원 아님·사업자·문의하기 */}
      <AppInfoRows />
      {/* 버전 줄: staging·개발 빌드에서만 7번 탭 → 개발자 메뉴(devGate). production 은 누르지 않는 글 행(화면 읽기에 '사용 안 함'으로 읽히지 않게) */}
      <SettingsRow
        testID={versionTap ? 'version-tap' : 'version-line'}
        title={t.version.split('{버전}').join(APP_VERSION)}
        onPress={versionTap}
        noChevron
      />
      {linked ? (
        <SettingsRow
          testID="settings-row-delete"
          danger
          title={t.delete_row}
          sub={t.delete_hint}
          onPress={() => navigation.navigate('DeleteAccount')}
        />
      ) : null}
    </Screen>
  );
}

// 도장 소리 토글(시안 P7_motion·P13, DECISIONS: 효과음은 도장 소리 하나라 이름 '도장 소리', 기본 켜짐). 이 기기에만 저장.
// 행 전체가 스위치(터치 64 이상, talkback R10 "도장 소리, 스위치, 켜짐, 도장을 찍을 때 짧은 소리").
// 저장값을 읽기 전에는 스위치를 그리지 않는다(켜짐→꺼짐 깜빡임 방지).
// AP-04 '배경 음악' 행(시안 PX_music·P13_more): 기본 꺼짐. 음원(CT-04)이 없으면 행을 그리지 않는다(호출부)
function BgmRow() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    prefs()
      .bgmEnabled()
      .then(v => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, []);
  const toggle = () => {
    if (on === null) {
      return;
    }
    setOn(!on);
    prefs().setBgmEnabled(!on);
  };
  return (
    <Pressable
      testID="bgm-row"
      accessibilityRole="switch"
      accessibilityLabel={copy.bgm.settings_row}
      accessibilityHint={copy.bgm.settings_sub}
      accessibilityState={{checked: !!on, disabled: on === null}}
      onPress={toggle}
      style={({pressed}) => [styles.section, styles.toggleRow, pressed ? styles.pressed : null]}>
      <View style={styles.toggleText}>
        <Text20 size={24} weight="bold">{copy.bgm.settings_row}</Text20>
        <Text20 style={styles.sub}>{copy.bgm.settings_sub}</Text20>
      </View>
      {on === null ? null : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Switch value={on} onValueChange={toggle} trackColor={{false: color.lineSoft, true: color.done}} thumbColor={color.card} />
        </View>
      )}
    </Pressable>
  );
}

function SfxRow() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    prefs()
      .sfxEnabled()
      .then(v => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, []);
  const toggle = () => {
    if (on === null) {
      return;
    }
    setOn(!on);
    prefs().setSfxEnabled(!on);
  };
  return (
    <Pressable
      testID="sfx-row"
      accessibilityRole="switch"
      accessibilityLabel={t.sfx}
      accessibilityHint={t.sfx_sub}
      accessibilityState={{checked: !!on, disabled: on === null}}
      onPress={toggle}
      style={({pressed}) => [styles.section, styles.toggleRow, pressed ? styles.pressed : null]}>
      <View style={styles.toggleText}>
        <Text20 size={24} weight="bold">{t.sfx}</Text20>
        <Text20 style={styles.sub}>{t.sfx_sub}</Text20>
      </View>
      {on === null ? null : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Switch
            value={on}
            onValueChange={toggle}
            trackColor={{false: color.lineSoft, true: color.done}}
            thumbColor={color.card}
          />
        </View>
      )}
    </Pressable>
  );
}

// '가족에게 답 보여 주기' 행: 이름·상태(한 덩어리 글) + 오른쪽 동사 버튼. 보여 주는 중 '그만 보여 주기'(흰 바탕+테두리),
// 보여 주지 않는 중 '다시 보여 주기'(채움). 누르면 행 아래에 확인을 펼친다(expanded 로 읽힘).
function ShareRow({consented, expanded, onPress}: {consented: boolean; expanded: boolean; onPress: () => void}) {
  const {fontScale, width} = useWindowDimensions();
  const wide = fontScale >= 1.5 || width <= 360; // 감사 M3: 150% 이상 또는 폭 360 이하면 쌓기
  const status = consented ? t.shared_now : t.not_shared_now;
  const verb = consented ? t.stop : t.resume;
  return (
    <View testID="settings-row-share" style={[styles.shareRow, wide ? styles.shareRowWide : null]}>
      <View accessible accessibilityRole="text" accessibilityLabel={`${t.share_row}, ${status}`} style={styles.toggleText}>
        <Text20 size={24} weight="bold">{t.share_row}</Text20>
        <Text20 style={styles.sub}>{status}</Text20>
      </View>
      <Pressable
        testID="share-verb"
        accessibilityRole="button"
        accessibilityLabel={verb}
        accessibilityState={{expanded}}
        onPress={onPress}
        style={({pressed}) => [styles.verb, consented ? styles.verbOutline : styles.verbFill, wide ? styles.verbWide : null, pressed ? styles.verbPressed : null]}>
        <Text20 weight="bold" style={consented ? styles.verbOutlineText : styles.verbFillText}>{verb}</Text20>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shareRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, minHeight: size.touchMin, backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 16},
  shareRowWide: {flexDirection: 'column', alignItems: 'stretch'},
  verb: {minHeight: size.touchMin, borderRadius: radius.button, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center'},
  verbWide: {alignSelf: 'stretch'},
  verbOutline: {backgroundColor: color.card, borderWidth: 3, borderColor: color.action},
  verbFill: {backgroundColor: color.action},
  verbPressed: {opacity: 0.8},
  verbOutlineText: {color: color.action},
  verbFillText: {color: color.onAction},
  toggleRow: {flexDirection: 'row', alignItems: 'center', minHeight: size.touchMin},
  pressed: {backgroundColor: color.actionSoft},
  toggleText: {flex: 1, gap: 4},
  title: {paddingBottom: 8},
  section: {backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 16, gap: 12},
  confirm: {backgroundColor: color.noticeSoft, borderRadius: radius.card, borderWidth: 4, borderColor: color.action, padding: 14, gap: 12},
  error: {backgroundColor: color.dangerSoft, borderRadius: radius.card, borderWidth: 3, borderColor: color.dangerInk, paddingVertical: 10, paddingHorizontal: 16, gap: 4},
  errorTitle: {color: color.dangerInk},
  sub: {color: color.inkSub},
});

// ── P13 '가족에게 이렇게 보여요' 화면(라우트 FamilyPreview). 이 파일에 두는 이유: app/ import(session·BackBar)를 새로 늘리지 않기(레이어 기준선) ──
const pv = copy.settings.preview;
const ch = copy.child;
const DEFAULT_TITLE = '부모님'; // 호칭이 없을 때(자녀 화면과 같은 기본값)
const OLDER_ROWS = 2; // 시안: 최근 답 카드 아래 지난 답 2줄

// P13 '가족에게 이렇게 보여요'(AP-06, 시안 P13_more '가족에게 이렇게 보여요(자녀 화면과 같은 내용)').
// 자녀 화면(C4 최근 답 카드·C5 지난 답 줄)에 실제로 보이는 것만 보여 준다: 호칭, 고른 답, 날짜(질문은 짧은 형 '산과 바다 중').
// 사진·자판 글자·안 한 날은 자녀에게 가지 않으므로 여기에도 없다(아래 두 줄이 그 사실을 말한다).
// - 동의 거부·철회: 자녀 화면은 '{호칭}의 최근 답 / 답을 나누지 않는 중이에요' → 같은 카드(시안 없음, 디자인 확인 요청 중).
// - 아직 고른 답 없음: '고른 답이 생기면 여기에 보여요' → 같은 카드(시안 없음, 디자인 확인 요청 중).
// 서버: parent_family_list(호칭) + parent_history(최근 30일, 저장된 답만 choice_label). 실패하면 불러오는 중 줄을 그대로 둔다.
export function FamilyPreviewScreen() {
  const navigation = useNavigation();
  const {api, consented} = useSession();
  const [title, setTitle] = useState<string | null>(null);
  const [answered, setAnswered] = useState<HistoryDay[] | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .parentFamilyList()
      .then(f => alive && setTitle(f.title ?? DEFAULT_TITLE))
      .catch(() => alive && setTitle(DEFAULT_TITLE));
    api
      .parentHistory(30)
      .then(h => alive && setAnswered(h.days.filter(d => d.choice_label !== null)))
      .catch(() => alive && setAnswered([]));
    return () => {
      alive = false;
    };
  }, [api]);

  const head = `${title ?? DEFAULT_TITLE}${ch.title_suffix}`;
  const latest = consented ? answered?.[0] : undefined;
  const older = consented ? (answered ?? []).slice(1, 1 + OLDER_ROWS) : [];
  const loading = title === null || answered === null;
  return (
    <Screen
      top={
        <>
          <BackBar />
          <Text20 size={30} weight="bold" accessibilityRole="header" style={pvStyles.title}>{pv.title}</Text20>
        </>
      }
      bottom={<BigButton label={pv.ok} onPress={() => navigation.goBack()} />}>
      {/* 디자인 확인(11-19): 거부·철회 상태에서는 첫 문장('최근 한 달 고른 답과 날짜가 보여요')이 거짓이라 뒤 문장만(라이터 확인 전) */}
      <Text20 testID="preview-sub" size={22} weight="bold" style={pvStyles.ink}>{consented ? pv.sub : subWithoutFirstSentence(pv.sub)}</Text20>
      <View testID="preview-device" style={pvStyles.device}>
        <Text20 weight="bold" style={pvStyles.sub}>{pv.device_label}</Text20>
        {loading ? (
          <Text20 testID="preview-loading">{appCopy.loading}</Text20>
        ) : latest ? (
          <>
            <View
              testID="preview-latest"
              accessible
              accessibilityLabel={[head, latest.choice_label, answerDate(latest.session_date)].join(', ')}
              style={pvStyles.card}>
              <Text20 weight="bold" style={pvStyles.sub}>{head}</Text20>
              <Text20 size={40} weight="bold" style={pvStyles.ink}>{latest.choice_label}</Text20>
              <Text20 weight="bold" style={pvStyles.sub}>{answerDate(latest.session_date)}</Text20>
            </View>
            {older.map(d => (
              <View
                key={d.session_date}
                testID="preview-older"
                accessible
                accessibilityLabel={`${answerDate(d.session_date)}, ${pairShort(d.question.option_a, d.question.option_b)}, ${d.choice_label}`}
                style={pvStyles.olderRow}>
                <Text20 weight="bold">{answerDate(d.session_date)}</Text20>
                <Text20>{` · ${pairShort(d.question.option_a, d.question.option_b)} `}</Text20>
                <Text20 size={22} weight="bold" style={pvStyles.ink}>{d.choice_label}</Text20>
              </View>
            ))}
          </>
        ) : (
          // 동의 거부·철회 또는 아직 답 없음: 자녀 C4 와 같은 머리 + 한 줄
          // 디자인 확인(11-19): 윗줄 '가족 휴대폰 화면'은 유지(없으면 어르신 자신의 상태로 읽힘), 카드 높이는 답 있음 카드와 비슷하게(최소 높이)
          <View testID={consented ? 'preview-empty' : 'preview-not-shared'} accessible style={[pvStyles.card, pvStyles.cardState]}>
            <Text20 weight="bold" style={pvStyles.sub}>{head}</Text20>
            <Text20 size={22}>{consented ? ch.no_answer : ch.not_shared}</Text20>
          </View>
        )}
      </View>
      <View style={pvStyles.notes}>
        <Text20>{`• ${pv.not_typed}`}</Text20>
        <Text20>{`• ${pv.not_days}`}</Text20>
      </View>
    </Screen>
  );
}

// '최근 한 달 고른 답과 날짜가 보여요. 연결된 날과 …' → 뒤 문장만(마침표 뒤). 마침표가 없으면 그대로
function subWithoutFirstSentence(s: string): string {
  const i = s.indexOf('. ');
  return i < 0 ? s : s.slice(i + 2);
}

// 자녀 화면(features/home/formatDate formatAnswerDate)과 같은 규칙: 오늘 / M월 D일 / 다른 해는 Y년 M월 D일. 기능 간 import 금지라 여기 둔다
function answerDate(ymd: string, now: Date = new Date()): string {
  const todayKst = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  if (ymd === todayKst) {
    return '오늘';
  }
  const [y, m, d] = ymd.split('-').map(Number);
  return y === Number(todayKst.slice(0, 4)) ? `${m}월 ${d}일` : `${y}년 ${m}월 ${d}일`;
}

const pvStyles = StyleSheet.create({
  title: {color: color.inkTitle, paddingHorizontal: 0, paddingBottom: 8},
  ink: {color: color.inkTitle},
  sub: {color: color.inkSub},
  device: {backgroundColor: color.paperSoft, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 18, gap: 10},
  card: {backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 18, gap: 6, boxShadow: shadow.soft},
  cardState: {minHeight: 150, justifyContent: 'center'}, // 답 있음 카드(머리 30 + 답 48 + 날짜 30 + 간격·여백)와 비슷하게
  olderRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline'},
  notes: {gap: 4, paddingLeft: 4},
});
