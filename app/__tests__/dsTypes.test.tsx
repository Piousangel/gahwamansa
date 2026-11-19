// 타입으로 막는 규칙(SUMMARY 3절 '타입'). 이 파일은 tsc(npx tsc --noEmit)가 검사한다 — @ts-expect-error 줄이 에러가 아니게 되면 tsc 가 실패한다.
// jest 는 아래 객체가 만들어지는지만 본다(실제 검사는 타입).
import React from 'react';
import {StyleSheet, type TextStyle} from 'react-native';
import {render, screen} from '@testing-library/react-native';
import {Text} from '../src/ui/ds';
import type {DockProps, FieldProps, TextProps, ButtonProps} from '../src/ui/ds';

const noop = () => {};

export const ok: DockProps[] = [
  {primary: {label: '다 썼어요', onPress: noop}},
  {primary: {label: '다 썼어요', onPress: noop}, secondary: {label: '다시 쓰기', onPress: noop}, note: {text: '천천히 해도 돼요'}},
  {primary: {social: [{provider: 'kakao', label: '카카오 로그인', onPress: noop}, {provider: 'google', label: 'Google로 로그인', onPress: noop}]}, note: {text: '이메일로 하기', onPress: noop}},
];

export const bad = [
  // 보조 슬롯은 하나뿐(두 번째 보조·세 번째 버튼 자리 없음)
  // @ts-expect-error tertiary 슬롯 없음
  {primary: {label: 'a', onPress: noop}, tertiary: {label: 'b', onPress: noop}} satisfies DockProps,
  // 자식(children)으로 아무것이나 넣을 수 없다
  // @ts-expect-error children 없음
  {primary: {label: 'a', onPress: noop}, children: null} satisfies DockProps,
  // 소셜 묶음은 자리별 provider(카카오 → 구글): 중복·순서 바뀜·넘침은 타입 에러(리뷰 L4)
  // @ts-expect-error 카카오 두 번
  {primary: {social: [{provider: 'kakao', label: 'a', onPress: noop}, {provider: 'kakao', label: 'b', onPress: noop}]}} satisfies DockProps,
  // @ts-expect-error 순서(구글 → 카카오)
  {primary: {social: [{provider: 'google', label: 'a', onPress: noop}, {provider: 'kakao', label: 'b', onPress: noop}]}} satisfies DockProps,
  // @ts-expect-error 세 개(지금 자리는 둘까지, apple 자산 뒤 연다)
  {primary: {social: [{provider: 'kakao', label: 'a', onPress: noop}, {provider: 'google', label: 'b', onPress: noop}, {provider: 'google', label: 'c', onPress: noop}]}} satisfies DockProps,
  // 소셜 묶음에 일반 버튼을 섞을 수 없다
  // @ts-expect-error social 과 label 동시
  {primary: {social: [{provider: 'kakao', label: 'a', onPress: noop}], label: 'x', onPress: noop}} satisfies DockProps,
  // 보조 슬롯에 주 버튼 kind 를 쓸 수 없다
  // @ts-expect-error secondary kind primary
  {primary: {label: 'a', onPress: noop}, secondary: {label: 'b', onPress: noop, kind: 'primary'}} satisfies DockProps,
  // Field 에 placeholder 가 없다(Q6)
  // @ts-expect-error placeholder 없음
  {label: '이름', value: '', onChangeText: noop, placeholder: '여기를 누르면'} satisfies FieldProps,
  // Text 는 원시 크기·색·말줄임을 받지 않는다
  // @ts-expect-error fontSize 는 role 로만
  {role: 'body', children: 'a', style: {fontSize: 30}} satisfies TextProps,
  // @ts-expect-error color 는 tone 으로만
  {role: 'body', children: 'a', style: {color: '#000'}} satisfies TextProps,
  // @ts-expect-error numberOfLines 없음(예외는 ellipsisException)
  {role: 'body', children: 'a', numberOfLines: 1} satisfies TextProps,
  // @ts-expect-error 고정 height 없음
  {label: 'a', onPress: noop, style: {height: 72}} satisfies ButtonProps,
  // 화면용 tone 은 본문·보조·제목 계열만(리뷰 M1): onAction·action·info 는 컴포넌트 안에서만
  // @ts-expect-error tone onAction
  {role: 'body', children: 'a', tone: 'onAction'} satisfies TextProps,
  // @ts-expect-error tone action(누를 수 없는 갈색 글자 금지, R-06)
  {role: 'body', children: 'a', tone: 'action'} satisfies TextProps,
  // @ts-expect-error tone info(단독 글자색 금지, R-08)
  {role: 'body', children: 'a', tone: 'info'} satisfies TextProps,
];

// 리터럴이 아닌 경로(리뷰 H1): StyleSheet.create 결과·TextStyle 변수에 레이아웃 아닌 키가 있으면 막힌다
const sheet = StyleSheet.create({font: {marginTop: 8, fontSize: 40, color: '#f00'}, tall: {marginTop: 8, height: 30}, okay: {marginTop: 8, alignSelf: 'center'}});
const loose: TextStyle = {fontSize: 40, margin: 2};
export const viaVariables = [
  // @ts-expect-error StyleSheet 의 fontSize·color
  {role: 'body', children: 'a', style: sheet.font} satisfies TextProps,
  // @ts-expect-error TextStyle 변수
  {role: 'body', children: 'a', style: loose} satisfies TextProps,
  // @ts-expect-error Button 바깥 height
  {label: 'a', onPress: noop, style: sheet.tall} satisfies ButtonProps,
  // 레이아웃만 있는 StyleSheet 는 된다
  {role: 'body', children: 'a', style: sheet.okay} satisfies TextProps,
];

test('타입 검사 대상 객체가 만들어진다(검사 자체는 tsc)', () => {
  expect(ok).toHaveLength(3);
  expect(bad.length).toBeGreaterThan(5);
  expect(React).toBeDefined();
  expect(viaVariables).toHaveLength(4);
});

test('런타임에서도 레이아웃 키만 쓴다(타입을 as 로 뚫어도 역할 값이 이긴다)', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  render(
    <Text role="body" testID="t" style={sheet.font as never}>
      a
    </Text>,
  );
  const st = StyleSheet.flatten(screen.getByTestId('t').props.style) as TextStyle;
  expect(st.fontSize).not.toBe(40);
  expect(st.color).not.toBe('#f00');
  expect(st.marginTop).toBe(8);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('fontSize'));
  warn.mockRestore();
});
