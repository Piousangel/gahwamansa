import React from 'react';
import {CodeInput} from '../../ui/CodeInput';
import {clearAll, deleteOne, inputDigit} from '../../ui/codeInputLogic';

// 6자리 번호 쓰기(역할에 묶이지 않음, 큰 키패드). 제출 버튼은 화면의 하단 고정 영역에 둔다.
export function CodeEntry({value, onChange, keyHeight}: {value: string; onChange: (next: string) => void; keyHeight?: number}) {
  return (
    <CodeInput
      value={value}
      onDigit={d => onChange(inputDigit(value, d))}
      onDelete={() => onChange(deleteOne(value))}
      onClear={() => onChange(clearAll())}
      keyHeight={keyHeight}
    />
  );
}
