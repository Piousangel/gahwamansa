import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {BackBar} from '../../app/BackBar';
import {Dialog} from '../../ui/Dialog';
import {AudienceProvider, Button, Choice, DsScreen, Heading, Sheet, StateView, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {useToast} from '../../ui/Toast';
import {Icon} from '../../ui/assets/icons';
import {appCopy, copy, withTitle} from '../../copy/copy';
import {APP_VERSION} from '../../lib/appInfo';
import {ChildParent, isOffline, LoginMethod, PARENT_TITLES} from '../types';
import {useChildSummary} from '../../shared/useChildData';
import {FamilyPushRow} from './FamilyPushRow';
import {clearAccountKeys} from '../../lib/accountStore';
import {defaultStore} from '../../lib/kvStore';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {track} from '../track';

const s = copy.child.settings;
const rel = copy.relation;
type Target = {parentId: string; title: string}; // parentId '' = 가족 기본 호칭(연결 전·옛 서버)

// C7 자녀 설정 v2: 어르신별(부르는 이름·새 폰 연결 번호) / 계정(로그인 수단·로그아웃·내 계정 지우기) / 앱(앱 정보).
// v4(V4-INDEX '시안 없음, 토큰 효과만'): 배치는 v2 그대로, 부품만 ui/ds(DsScreen·Text 역할·StateView·Sheet+Choice). 로그아웃 확인은 어르신과 함께 쓰는 Dialog 그대로.
export function ChildSettings() {
  const navigation = useNavigation<NativeStackNavigationProp<ChildParams>>();
  const {api, resetRole} = useSession();
  const {info, error, load} = useChildSummary();
  const [method, setMethod] = useState<LoginMethod | null>(null);
  const [editing, setEditing] = useState<Target | null>(null);
  const [picked, setPicked] = useState('부모님');
  const [saving, setSaving] = useState(false);
  const [logout, setLogout] = useState(false);
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [modalError, setModalError] = useState<string | null>(null); // 리뷰 M2: 시트·대화상자 안 오류 줄
  const {show} = useToast();
  // 부르는 이름 시트가 닫히면 연 행으로 포커스(ds Sheet returnFocusRef 필수, PR #93 M1)
  const nameRows = useRef<Record<string, React.ComponentRef<typeof Pressable> | null>>({});
  const opener = useRef<React.ComponentRef<typeof Pressable> | null>(null);
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
    opener.current = nameRows.current[t.parentId || 'family'] ?? null;
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
    if (!beginBusy()) {
      return;
    }
    try {
      const code = await api.issueInviteCode(t.parentId);
      track(api, 'invite_code_issued', {purpose: 'reconnect'}); // AC-05: 어르신 새 폰 번호
      navigation.navigate('Code', {code, title: t.title});
    } catch (e) {
      show({text: failText(e), kind: 'error', action: {label: copy.errors.offline.button, onPress: () => newPhoneCode(t)}});
    } finally {
      endBusy();
    }
  };
  const doLogout = async () => {
    if (!beginBusy()) {
      return;
    }
    const tag = await api.accountTag().catch(() => null); // 로그아웃 뒤에는 세션이 없어 먼저 받아 둔다
    try {
      await api.signOut();
      setLogout(false);
      resetRole(); // 첫 화면(역할 선택)으로
    } catch (e) {
      endBusy();
      setModalError(failText(e)); // 대화상자 안에 알린다
    } finally {
      await clearAccountKeys(defaultStore(), tag); // 리뷰 M4·재검토 R2: signOut 이 실패해도 이 계정의 기기 기억값은 정리
    }
  };
  const logoutBody = method
    ? s.logout_body.split('{수단}').join(s.method[method])
    : s.logout_body.replace('({수단})', '');

  return (
    <AudienceProvider value="child">
      <DsScreen
        variant="step"
        header={
          <>
            <BackBar />
            <Heading level={1}>{s.title}</Heading>
          </>
        }>
        {!info && !error ? <StateView kind="loading" title={appCopy.loading} /> : null}
        {error && !info ? <StateView kind="error" title={error.title} action={{label: error.button, onPress: load}} /> : null}
        {targets.map(t => (
          <View key={t.parentId || 'family'} style={styles.group}>
            <GroupTitle>{t.title}</GroupTitle>
            <View style={styles.section}>
              <Row
                label={s.name_row}
                value={t.title}
                onPress={() => openName(t)}
                pressRef={r => {
                  nameRows.current[t.parentId || 'family'] = r;
                }}
              />
              {t.linked ? <Row label={s.newphone_row} sub={withTitle(s.newphone_sub, t.title)} onPress={() => newPhoneCode(t)} /> : null}
            </View>
          </View>
        ))}
        <View style={styles.group}>
          <GroupTitle>{s.account}</GroupTitle>
          <View style={styles.section}>
            {/* '가족 연결' 알림: 앱 안 토글(켬·끔 = set_push_enabled, 리드 결정 11-18), 휴대폰에서 꺼져 있으면 켜는 길 */}
            <FamilyPushRow api={api} />
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
          <GroupTitle>{s.app}</GroupTitle>
          <View style={styles.section}>
            <Row label={s.app_info} sub={s.version.split('{버전}').join(APP_VERSION)} onPress={() => navigation.navigate('AppInfo')} />
          </View>
        </View>
        <Text role="sub" tone="muted" style={styles.foot}>
          {s.not_safety}
        </Text>
      </DsScreen>
      <Sheet
        testID="sheet"
        visible={!!editing}
        onClose={() => setEditing(null)}
        closeLabel={copy.child.cheer.close}
        title={rel.title}
        sub={rel.hint}
        returnFocusRef={opener}
        footer={
          <>
            {/* 시트 안 오류 한 줄(모달 위 토스트는 보이지 않는다, 리뷰 M2) */}
            <View accessibilityLiveRegion="polite">
              {modalError ? (
                <Text role="body" tone="danger" testID="sheet-error">
                  {modalError}
                </Text>
              ) : null}
            </View>
            <Button
              kind="primary"
              size="dock"
              label={s.name_save}
              onPress={saveName}
              disabled={saving || pickedTaken}
              disabledReason={pickedTaken ? copy.relation.name_taken : undefined}
            />
          </>
        }>
        <Choice
          mode="radio"
          columns={2}
          testID="title-group"
          accessibilityLabel={rel.title}
          items={PARENT_TITLES.map(p => ({key: p, label: p}))}
          value={picked}
          onSelect={setPicked}
        />
        <Text role="sub" tone="muted">
          {rel.fallback}
        </Text>
      </Sheet>
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
    </AudienceProvider>
  );
}

/** 묶음 이름(머리글): 보조색 sub — 각 묶음 시작을 화면 읽기에 알린다 */
function GroupTitle({children}: {children: string}) {
  return (
    <Text role="label" tone="muted" accessibilityRole="header">
      {children}
    </Text>
  );
}

// 설정 행: 이름 + 보조 글/값, 누를 수 있으면 오른쪽 화살표. 터치 자녀 최소 이상(ds.touch)
function Row({
  label,
  sub,
  value,
  onPress,
  danger,
  testID,
  pressRef,
}: {
  label: string;
  sub?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  testID?: string;
  pressRef?: (r: React.ComponentRef<typeof Pressable> | null) => void;
}) {
  const inner = (
    <>
      <View style={styles.flex}>
        <Text role="bodyLg" tone={danger ? 'danger' : 'default'}>
          {label}
        </Text>
        {sub ? (
          <Text role="sub" tone="muted">
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text role="body" tone="muted">
          {value}
        </Text>
      ) : null}
      {onPress ? <Icon name="icon-chevron-right" size={22} color={ds.color.inkSubChild} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} style={styles.row} accessible accessibilityLabel={sub ? `${label}, ${sub}` : label}>
        {inner}
      </View>
    );
  }
  return (
    <Pressable
      ref={pressRef}
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
  group: {gap: 6, alignSelf: 'stretch'},
  section: {backgroundColor: ds.color.card, borderRadius: ds.radius.card, paddingHorizontal: 16, paddingVertical: 4},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: ds.touch.child.primary, paddingVertical: 10},
  pressed: {opacity: 0.6},
  foot: {textAlign: 'center', marginTop: 8},
});
