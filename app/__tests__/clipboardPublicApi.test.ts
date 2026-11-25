// 대기열 51(#278): 복사가 개발 경고(깊은 import 'Deep imports … are deprecated' / 최상위 Clipboard 폐기 warnOnce)를 내면
// LogBox 알림이 화면 아래 행을 덮어 Maestro F5 가 흔들렸다. copyText 는 공개 API(TurboModuleRegistry)로 네이티브 모듈만 부른다.
import {TurboModuleRegistry} from 'react-native';

declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');

afterEach(() => jest.restoreAllMocks());

test('네이티브 Clipboard 모듈의 setString 을 부르고 true', () => {
  const setString = jest.fn();
  const get = jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({setString} as never);
  const {copyText} = require('../src/ui/clipboard');
  expect(copyText('123456')).toBe(true);
  expect(get).toHaveBeenCalledWith('Clipboard');
  expect(setString).toHaveBeenCalledWith('123456');
});

test('모듈이 없거나 실패하면 false(화면은 복사 실패 안내)', () => {
  const {copyText} = require('../src/ui/clipboard');
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(null);
  expect(copyText('1')).toBe(false);
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({setString: () => { throw new Error('x'); }} as never);
  expect(copyText('1')).toBe(false);
});

test('불러오기·복사 어디에서도 개발 경고를 내지 않는다(LogBox 알림 없음)', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({setString: jest.fn()} as never);
  jest.isolateModules(() => {
    require('../src/ui/clipboard').copyText('1');
  });
  expect(warn).not.toHaveBeenCalled();
});

test('소스에 react-native 깊은 import·최상위 Clipboard 가 없다(개발 빌드 babel 경고·폐기 경고의 출처)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/ui/clipboard.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  expect(src).not.toMatch(/['"]react-native\/[^'"]+['"]/);
  expect(src).not.toMatch(/\bClipboard\s*[,}]|\.Clipboard\b/);
});
