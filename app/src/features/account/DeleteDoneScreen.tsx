import React from 'react';
import {CommonActions, useNavigation, useRoute} from '@react-navigation/native';
import {DsScreen, Heading, Text} from '../../ui/ds';
import {copy, withTitle} from '../../copy/copy';
import type {DeleteScope} from '../types';
import {contactMail, openContactMail} from './contactMail';

// 계정 지운 뒤(어르신·자녀 공용). v4: 부품만 ui/ds — 제목 Heading(머리글·첫 포커스) + 자녀 감사 한 줄 + Dock '처음으로'.
// 법률 확인(11-20): 어르신이 앱을 다시 설치해 새 익명 계정으로 지우면 그 빈 계정만 지워진다(scope none) — 옛 프로필은 남는다.
//   그때 '모두 지웠어요'는 거짓 안내라, 지울 기록이 없었다는 사실 + 문의하기(계정 지우기 로그인 풀림 어르신 안내와 같은 경로, #153).
export function DeleteDoneScreen() {
  const navigation = useNavigation();
  const {params} = useRoute();
  const {scope, role, title, noRecord} = (params ?? {}) as {scope: DeleteScope; role: 'parent' | 'child'; title?: string; noRecord?: boolean};
  const d = copy.delete;
  // noRecord 판단(사전 조회·앞선 실패)은 계정 지우기 화면이 한다
  const parentNone = role === 'parent' && scope === 'none' && !!noRecord;
  const mail = parentNone ? contactMail() : null;
  const message = parentNone
    ? d.parent.done_none.title
    : role === 'parent'
      ? d.parent.done
      : scope === 'family'
        ? withTitle(d.child.done_last, title ?? '부모님')
        : d.child.done_keep;
  return (
    <DsScreen
      variant="form"
      header={<Heading level={1}>{message}</Heading>}
      dock={{
        primary: {
          label: role === 'child' ? d.child.back : d.parent.back,
          onPress: () => navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: role === 'child' ? 'Login' : 'Connect'}]})),
        },
        ...(mail ? {secondary: {kind: 'secondary' as const, label: d.signed_out_parent.button, onPress: () => openContactMail(mail), testID: 'delete-done-contact'}} : {}),
      }}>
      {role === 'child' ? <Text role="bodyLg">{d.child.thanks}</Text> : null}
      {parentNone ? <Text role="bodyLg">{d.parent.done_none.body}</Text> : null}
      {parentNone && !mail ? (
        <Text role="body" testID="delete-done-contact-pending">
          {copy.app_info.contact_pending}
        </Text>
      ) : null}
    </DsScreen>
  );
}
