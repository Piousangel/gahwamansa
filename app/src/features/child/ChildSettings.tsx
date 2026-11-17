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
import {BottomSheet, Dialog} from '../../shared/u0Overlays';
import {useToast} from '../../shared/u0Overlays';
import {Icon} from '../../ui/assets/icons';
import {appCopy, copy, withTitle} from '../../copy/copy';
import {color, radius, size} from '../../ui/tokens';
import {APP_VERSION} from '../../lib/appInfo';
import {ChildParent, isOffline, LoginMethod, PARENT_TITLES} from '../types';
import {useChildSummary} from '../../shared/useChildData';

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
  const [busy, setBusy] = useState(false);
  const {toast, show} = useToast();
  const fail = (e: unknown) => show(isOffline(e) ? copy.errors.offline.title : copy.errors.server.title);

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
    setEditing(t);
  };
  const saveName = async () => {
    if (!editing || saving) {
      return;
    }
    setSaving(true);
    try {
      const r = editing.parentId ? await api.setParentTitleFor(editing.parentId, picked) : await api.setParentTitle(picked);
      if (!r.ok) {
        throw new Error('invalid_title');
      }
      setEditing(null);
      show(s.name_changed);
      load();
    } catch (e) {
      fail(e);
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
      fail(e);
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
      await api.signOut();
      setLogout(false);
      resetRole(); // 첫 화면(역할 선택)으로
    } catch (e) {
      setBusy(false);
      fail(e);
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
            {method ? <Row label={s.login_row} sub={s.login_via.split('{수단}').join(s.via[method])} /> : null}
            <Row label={s.logout} onPress={() => setLogout(true)} />
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
        visible={!!editing}
        onClose={() => setEditing(null)}
        closeLabel={copy.child.cheer.close}
        title={rel.title}
        hint={rel.hint}
        footer={<BigButton label={s.name_save} loading={saving} onPress={saveName} />}>
        {PARENT_TITLES.map(p => (
          <SelectCard key={p} label={p} selected={picked === p} onPress={() => setPicked(p)} />
        ))}
        <Text20>{rel.fallback}</Text20>
      </BottomSheet>
      <Dialog visible={logout} onClose={() => setLogout(false)} title={s.logout_title} body={logoutBody}>
        <BigButton label={s.logout} loading={busy} onPress={doLogout} />
        <BigButton variant="secondary" label={s.logout_cancel} onPress={() => setLogout(false)} />
      </Dialog>
      {toast}
    </View>
  );
}

// 설정 행: 이름(굵게) + 보조 글/값, 누를 수 있으면 오른쪽 화살표. 터치 64 이상.
function Row({label, sub, value, onPress, danger}: {label: string; sub?: string; value?: string; onPress?: () => void; danger?: boolean}) {
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
    return <View style={styles.row} accessible accessibilityLabel={sub ? `${label}, ${sub}` : label}>{inner}</View>;
  }
  return (
    <Pressable
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
