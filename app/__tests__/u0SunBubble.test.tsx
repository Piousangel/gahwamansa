import React from 'react';
import {AccessibilityInfo, StyleSheet} from 'react-native';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {SunBubble, hanimTextIssues, hanimArt} from '../src/ui/SunBubble';
import {FONT_SCALE_MAX_BODY} from '../src/ui/tokens';

declare const __dirname: string;
type Dirent = {name: string; isDirectory(): boolean};
const fs: {readdirSync(d: string, o: {withFileTypes: true}): Dirent[]; readFileSync(f: string, e: 'utf8'): string; existsSync(p: string): boolean} = require('fs');
const path: {join(...p: string[]): string} = require('path');

describe('SunBubble(해님 말풍선)', () => {
  test('말풍선 글자만 읽히고 해님 그림은 화면 읽기에서 숨는다', () => {
    render(<SunBubble moment="firstMeet" text="오늘도 만나서 반가워요!" />);
    expect(screen.getByLabelText('오늘도 만나서 반가워요!')).toBeTruthy();
    const art = screen.getByTestId('sun-bubble-art', {includeHiddenElements: true});
    expect(art.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(art.props.accessibilityElementsHidden).toBe(true);
  });

  test('글자는 24(최소 20 이상), 본문 배율 상한 2.0', () => {
    render(<SunBubble moment="complete" text="오늘 코스를 마쳤어요" />);
    const t = screen.getByText('오늘 코스를 마쳤어요');
    expect(StyleSheet.flatten(t.props.style).fontSize).toBe(24);
    expect(t.props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX_BODY);
  });

  test('말할 수 있는 때는 첫 만남·완료·오류뿐이고, 때마다 표정이 정해진다', () => {
    expect(hanimArt('firstMeet', 88)).toBe('sun-wave');
    expect(hanimArt('complete', 88)).toBe('sun-happy');
    expect(hanimArt('error', 56)).toBe('sun-worry');
    // 40 이하는 도장(기본 미소)만 있다. 걱정 표정은 56 이상이라 오류는 56으로 올린다
    expect(hanimArt('firstMeet', 40)).toBe('sun-stamp');
    expect(hanimArt('error', 40)).toBe('sun-worry');
  });

  test('오류 때 크기 40을 요청해도 걱정 표정이 보이도록 56으로 그린다', () => {
    render(<SunBubble moment="error" size={40} text="앱이 잠깐 헷갈렸어요" />);
    const art = screen.getByTestId('sun-bubble-art', {includeHiddenElements: true});
    expect(StyleSheet.flatten(art.props.style).width).toBe(56);
  });

  test('읽어 주기 버튼은 아이콘만이 아니라 글자 "읽어 주세요"(R7 라벨=보이는 글), 64 이상, 누르면 호출', () => {
    const fn = jest.fn();
    render(<SunBubble moment="firstMeet" text="오늘의 사진을 천천히 보세요" readAloud={{label: '읽어 주세요', onPress: fn}} />);
    const btn = screen.getByRole('button', {name: '읽어 주세요'});
    expect(screen.getByText('읽어 주세요')).toBeTruthy();
    expect(screen.getByText('읽어 주세요').props.maxFontSizeMultiplier).toBe(1.5);
    const s = StyleSheet.flatten(btn.props.style);
    expect(s.minWidth).toBeGreaterThanOrEqual(64);
    expect(s.minHeight).toBeGreaterThanOrEqual(64);
    fireEvent.press(btn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('R16: 화면 읽기가 켜져 있으면 읽어 주기 버튼을 숨긴다(소리 겹침)', async () => {
    const sr = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockImplementation(() => Promise.resolve(true));
    render(<SunBubble moment="firstMeet" text="오늘의 사진을 천천히 보세요" readAloud={{label: '읽어 주세요', onPress: () => {}}} />);
    await waitFor(() => expect(screen.queryByRole('button', {name: '읽어 주세요'})).toBeNull());
    expect(sr).toHaveBeenCalled();
    sr.mockImplementation(() => Promise.resolve(false));
  });

  test('읽어 주기가 없으면 말풍선은 누를 수 없다(버튼 0개)', () => {
    render(<SunBubble moment="complete" text="오늘 코스를 마쳤어요" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  test('문구 검사: 하트·칭찬·너무 긴 문장을 잡아낸다', () => {
    expect(hanimTextIssues('오늘도 만나서 반가워요!')).toEqual([]);
    expect(hanimTextIssues('정말 잘하셨어요 ♥')).toEqual(expect.arrayContaining(['heart', 'praise']));
    expect(hanimTextIssues('최고예요')).toContain('praise');
    expect(hanimTextIssues('가'.repeat(41))).toContain('tooLong');
  });

  test('개발 중 규칙 위반 문구는 경고한다', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(<SunBubble moment="complete" text="훌륭해요 ❤" />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[해님 규칙]'));
    warn.mockRestore();
  });

  test('자녀 화면에서는 해님을 쓰지 않는다(DECISIONS 11-17)', () => {
    const src = path.join(__dirname, '../src/features');
    const childDirs = ['child', 'home'].map(d => path.join(src, d)).filter(d => fs.existsSync(d));
    const offenders: string[] = [];
    const walk = (dir: string) =>
      fs.readdirSync(dir, {withFileTypes: true}).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(p);
        } else if (/\.tsx?$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('SunBubble')) {
          offenders.push(p);
        }
      });
    childDirs.forEach(walk);
    expect(offenders).toEqual([]);
  });
});
