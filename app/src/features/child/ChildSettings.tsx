import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {BackBar} from '../../app/BackBar';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {SelectCard} from '../../ui/SelectCard';
import {BottomSheet} from '../../ui/BottomSheet';
import {Dialog} from '../../ui/Dialog';
import {useToast} from '../../ui/Toast';
import {Icon} from '../../ui/assets/icons';
import {appCopy, copy, withTitle} from '../../copy/copy';
import {color, radius, size} from '../../ui/tokens';
import {APP_VERSION} from '../../lib/appInfo';
import {ChildParent, isOffline, LoginMethod, PARENT_TITLES} from '../types';
import {useChildSummary} from '../../shared/useChildData';
import {useNotifyPermission} from './useNotifyPermission';
import {clearAccountKeys} from '../../lib/accountStore';
import {defaultStore} from '../../lib/kvStore';

const s = copy.child.settings;
const rel = copy.relation;
type Target = {parentId: string; title: string}; // parentId '' = 가족 기본 호칭(연결 전·옛 서버)

// C7 자녀 설정 v2: 어르신별(부르는 이름·새 폰 연결 번호) / 계정(로그인 수단·로그아웃·내 계정 지우기) / 앱(앱 정보).
// 알림 행은 연결 뒤 자녀 알림이 정해질 때까지 숨김(copy-v3 10절).
export function ChildSettings() {
  const navigation = useNavigation<NativeStackNavigationProp<ChildParams>>();
  const {api, resetRole} = useSession();
  const {info, error, load} = useChildSummary();
  const [method, setMethod] = useState<LoginMethod | null>(null);
  const [editing, setEditing] = useState<Target | null>(null);
  const [picked, setPicked] = useState('부모님');
  const [saving, setSaving] = useState(false);
  const [logout, setLogout] = useState(false);
  const notify = useNotifyPermission();
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null); // 리뷰 M2: 시트·대화상자 안 오류 줄
  const {show} = useToast();
  const failText = (e: unknown) => (isOffline(e) ? copy.errors.offline.title : copy.errors.server.title);

  useEffect(() => {
    let alive = true;
    api
      .getLoginMethod()
      .then(m => alive && setMethod(m))
      .catch(() => {}); // 모르면 행 보조 글만 숨긴다
    return () => {
      alive = false;
    };
  }, [api]);

  const targets: (Target & {linked: boolean})[] = info
    ? info.parents.length
      ? info.parents.map((p: ChildParent) => ({parentId: p.parentId, title: p.title, linked: true}))
      : [{parentId: '', title: info.parentTitle, linked: false}]
    : [];

  const openName = (t: Target) => {
    setPicked(t.title);
    setModalError(null);
    setEditing(t);
  };
  // 리뷰 L4(리드 결정): 다른 어르신이 쓰는 호칭은 고를 수 없다(머리글·토스트로 구분이 안 되므로)
  const taken = new Set(targets.filter(t => editing && t.parentId !== editing.parentId).map(t => t.title));
  const pickedTaken = taken.has(picked);
  const saveName = async () => {
    if (!editing || saving || pickedTaken) {
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      // 어르신이 있으면 set_parent_title_for(가족 기본 호칭 set_parent_title 은 폐기 예정, 연결 전에만)
      const r = editing.parentId ? await api.setParentTitleFor(editing.parentId, picked) : await api.setParentTitle(picked);
      if (!r.ok) {
        // 서버도 같은 호칭을 막는다(0028 duplicate_title). 앱이 먼저 막지만 다른 기기에서 바뀐 경우 시트 안에 알린다
        setModalError(r.reason === 'duplicate_title' ? copy.relation.name_taken : copy.errors.server.title);
        load();
        return;
      }
      setEditing(null);
      show({text: s.name_changed});
      load();
    } catch (e) {
      setModalError(failText(e)); // 시트가 열린 채라 시트 안에 알린다
    } finally {
      setSaving(false);
    }
  };
  const newPhoneCode = async (t: Target) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const code = await api.issueInviteCode(t.parentId);
      navigation.navigate('Code', {code, title: t.title});
    } catch (e) {
      show({text: failText(e), kind: 'error', action: {label: copy.errors.offline.button, onPress: () => newPhoneCode(t)}});
    } finally {
      setBusy(false);
    }
  };
  const doLogout = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const tag = await api.accountTag().catch(() => null); // 로그아웃 뒤에는 세션이 없어 먼저 받아 둔다
      await api.signOut();
      await clearAccountKeys(defaultStore(), tag); // 리뷰 M4: 이 계정의 기기 기억값(N3 본 목록·C6 관심) 정리
      setLogout(false);
      resetRole(); // 첫 화면(역할 선택)으로
    } catch (e) {
      setBusy(false);
      setModalError(failText(e)); // 대화상자 안에 알린다
    }
  };
  const logoutBody = method
    ? s.logout_body.split('{수단}').join(s.method[method])
    : s.logout_body.replace('({수단})', '');

  return (
    <View style={styles.flex}>
      <Screen
        top={
          <>
            <BackBar />
            <Text20 size={32} weight="bold" accessibilityRole="header" style={styles.title}>{s.title}</Text20>
          </>
        }>
        {!info && !error ? <Text20>{appCopy.loading}</Text20> : null}
        {error && !info ? (
          <View style={styles.section}>
            <Text20 weight="bold">{error.title}</Text20>
            <BigButton variant="secondary" label={error.button} onPress={load} />
          </View>
        ) : null}
        {targets.map(t => (
          <View key={t.parentId || 'family'} style={styles.group}>
            <Text20 weight="bold" style={styles.groupTitle} accessibilityRole="header">{t.title}</Text20>
            <View style={styles.section}>
              <Row label={s.name_row} value={t.title} onPress={() => openName(t)} />
              {t.linked ? (
                <Row label={s.newphone_row} sub={withTitle(s.newphone_sub, t.title)} onPress={() => newPhoneCode(t)} />
              ) : null}
            </View>
          </View>
        ))}
        <View style={styles.group}>
          <Text20 weight="bold" style={styles.groupTitle} accessibilityRole="header">{s.account}</Text20>
          <View style={styles.section}>
            {/* AC-04 알림 행(실제 권한 상태): 켜짐이면 무엇을 알려 주는지, 꺼짐이면 휴대폰 설정에서 꺼져 있다 + 눌러서 켜기. 상태를 모르면 숨김 */}
            {notify.state === 'granted' ? <Row testID="child-notify-row" label={copy.push.settings_row} sub={copy.push.channel.family_desc} /> : null}
            {notify.state === 'denied' ? (
              <Row testID="child-notify-row" label={copy.push.settings_row} sub={copy.push.system_off.body} value={copy.push.system_off.open_child} onPress={notify.open} />
            ) : null}
            {method ? <Row label={s.login_row} sub={s.login_via.split('{수단}').join(s.via[method])} /> : null}
            <Row
              label={s.logout}
              onPress={() => {
                setModalError(null);
                setLogout(true);
              }}
            />
            <Row label={copy.child.delete_link} danger onPress={() => navigation.navigate('DeleteAccount')} />
          </View>
        </View>
        <View style={styles.group}>
          <Text20 weight="bold" style={styles.groupTitle} accessibilityRole="header">{s.app}</Text20>
          <View style={styles.section}>
            <Row label={s.app_info} sub={s.version.split('{버전}').join(APP_VERSION)} onPress={() => navigation.navigate('AppInfo')} />
          </View>
        </View>
        <Text20 style={styles.foot}>{s.not_safety}</Text20>
      </Screen>
      <BottomSheet
        testID="sheet"
        visible={!!editing}
        onClose={() => setEditing(null)}
        closeLabel={copy.child.cheer.close}
        title={rel.title}
        body={rel.hint}
        error={modalError}
        primary={{label: s.name_save, onPress: saveName, disabled: saving || pickedTaken, disabledReason: pickedTaken ? copy.relation.name_taken : undefined}}>
        {PARENT_TITLES.map(p => (
          <SelectCard key={p} label={p} selected={picked === p} onPress={() => setPicked(p)} />
        ))}
        <Text20>{rel.fallback}</Text20>
      </BottomSheet>
      <Dialog
        testID="dialog"
        visible={logout}
        title={s.logout_title}
        body={logoutBody}
        error={modalError}
        onBack={() => setLogout(false)}
        actions={[
          {label: s.logout, onPress: doLogout, kind: 'primary', loading: busy},
          {label: s.logout_cancel, onPress: () => setLogout(false), kind: 'secondary'},
        ]}
      />
    </View>
  );
}

// 설정 행: 이름(굵게) + 보조 글/값, 누를 수 있으면 오른쪽 화살표. 터치 64 이상.
function Row({label, sub, value, onPress, danger, testID}: {label: string; sub?: string; value?: string; onPress?: () => void; danger?: boolean; testID?: string}) {
  const inner = (
    <>
      <View style={styles.flex}>
        <Text20 weight="bold" style={danger ? styles.danger : null}>{label}</Text20>
        {sub ? <Text20 style={styles.sub}>{sub}</Text20> : null}
      </View>
      {value ? <Text20 style={styles.sub}>{value}</Text20> : null}
      {onPress ? <Icon name="icon-chevron-right" size={22} color={color.inkSub} /> : null}
    </>
  );
  if (!onPress) {
    return <View testID={testID} style={styles.row} accessible accessibilityLabel={sub ? `${label}, ${sub}` : label}>{inner}</View>;
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[label, value, sub].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed ? styles.pressed : null]}>
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  title: {paddingBottom: 8},
  group: {gap: 6},
  groupTitle: {color: color.inkSub},
  section: {backgroundColor: color.card, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 4},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: size.touchMin, paddingVertical: 10},
  pressed: {opacity: 0.6},
  sub: {color: color.inkSub},
  danger: {color: color.dangerInk},
  foot: {color: color.inkSub, textAlign: 'center', marginTop: 8},
});
