// 타입으로 막는 규칙(SUMMARY 3절 '타입'). 이 파일은 tsc(npx tsc --noEmit)가 검사한다 — @ts-expect-error 줄이 에러가 아니게 되면 tsc 가 실패한다.
// jest 는 아래 객체가 만들어지는지만 본다(실제 검사는 타입).
import React from 'react';
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
  // 소셜 묶음은 3개까지
  {
    primary: {
      social: [
        {provider: 'kakao', label: 'a', onPress: noop},
        {provider: 'google', label: 'b', onPress: noop},
        {provider: 'kakao', label: 'c', onPress: noop},
        // @ts-expect-error SocialButton 4개(묶음은 3개까지)
        {provider: 'google', label: 'd', onPress: noop},
      ],
    },
  } satisfies DockProps,
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
];

test('타입 검사 대상 객체가 만들어진다(검사 자체는 tsc)', () => {
  expect(ok).toHaveLength(3);
  expect(bad.length).toBeGreaterThan(5);
  expect(React).toBeDefined();
});
