// 글자 복사. 새 의존성 금지라 RN 코어의 (폐기 예정) Clipboard 를 직접 불러 쓴다.
// TODO(의존성): 코어에서 빠지면 @react-native-clipboard/clipboard 로 교체(리드 승인 필요). 실패하면 false.
export function copyText(text: string): boolean {
  try {
    // 최상위 import 는 폐기 경고 getter 를 거친다. 의존성 교체 전까지 직접 불러온다.
    // eslint-disable-next-line @react-native/no-deep-imports
    const mod = require('react-native/Libraries/Components/Clipboard/Clipboard');
    (mod.default ?? mod).setString(text);
    return true;
  } catch {
    return false;
  }
}
