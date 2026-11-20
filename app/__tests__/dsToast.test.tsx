// ds Toast(v5 값): 구현이 ui/ds 로 옮겨 오고 v5 생성물 값만 쓰는지, 옛 경로(ui/Toast)가 같은 것을 내보내는지.
// 동작(시간·초점·onExpire)은 u0Toast·childUx 테스트가 지킨다.
import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {ToastProvider, useToast} from '../src/ui/ds';
import * as legacy from '../src/ui/Toast';
import * as dsMod from '../src/ui/ds';
import {tokensV4 as t} from '../src/ui/tokensV4';

const fs: {readFileSync(p: string, e: string): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');
const H = {includeHiddenElements: true};

function Harness() {
  const toast = useToast();
  return (
    <>
      <Pressable testID="info" onPress={() => toast.show({text: '복사했어요', action: {label: '취소', onPress: () => {}}})}>
        <Text>info</Text>
      </Pressable>
      <Pressable testID="err" onPress={() => toast.show({text: '못 보냈어요', kind: 'error', action: {label: '다시 하기', onPress: () => {}}})}>
        <Text>err</Text>
      </Pressable>
    </>
  );
}

beforeEach(() => {
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
});

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, H).props.style);
const textStyle = (s: string) => StyleSheet.flatten(screen.getByText(s, H).props.style);

test('옛 경로 ui/Toast 는 ds Toast 를 그대로 내보낸다', () => {
  expect(legacy.ToastProvider).toBe(dsMod.ToastProvider);
  expect(legacy.useToast).toBe(dsMod.useToast);
  expect(legacy.TOAST_MS).toBe(dsMod.TOAST_MS);
});

test('안내 토스트: 먹 면·흰 글자(자녀 heading 20, 확대 1.5까지)·v5 반경 row·그림자 없음(규칙은 시트·대화상자만), 행동은 밑줄', async () => {
  await act(async () => fireEvent.press(screen.getByTestId('info')));
  const box = flat('toast');
  expect(box.backgroundColor).toBe(t.color.inkTitle);
  expect(box.borderRadius).toBe(t.radius.row);
  expect(box.boxShadow).toBeUndefined();
  expect(screen.getByText('복사했어요', H).props.maxFontSizeMultiplier).toBe(1.5);
  expect(textStyle('복사했어요')).toMatchObject({color: t.color.onAction, fontSize: t.type.heading.child.size, fontWeight: '700'});
  expect(textStyle('취소')).toMatchObject({color: t.color.onAction, textDecorationLine: 'underline'});
});

test('오류 토스트: dangerSoft 면·danger 3px 테두리·dangerInk 글자', async () => {
  await act(async () => fireEvent.press(screen.getByTestId('err')));
  expect(flat('toast')).toMatchObject({backgroundColor: t.color.dangerSoft, borderWidth: 3, borderColor: t.color.danger});
  expect(textStyle('못 보냈어요').color).toBe(t.color.dangerInk);
});

test('#199 리뷰 M: 토스트가 쓰는 색 조합은 v5 allowed 표에 있다(흰 글자 on 먹, danger 테두리 on dangerSoft)', () => {
  const a = require('../../design-system/tokens-v5.json').allowed;
  expect(a.childText.onAction).toContain('inkTitle');
  expect(a.childText.dangerInk).toContain('dangerSoft');
  expect(a.nonText.danger).toContain('dangerSoft');
});

test('ds/Toast 소스는 v3 tokens·Text20 을 가져오지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/ui/ds/Toast.tsx'), 'utf8');
  expect(src).not.toMatch(/from '\.\.\/tokens'|Text20/);
});
