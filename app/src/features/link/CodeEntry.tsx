import React, {type RefObject} from 'react';
import {View} from 'react-native';
import {CodeInput} from '../../ui/CodeInput';
import {clearAll, deleteOne, inputDigit} from '../../ui/codeInputLogic';
import {hapticKeyTap} from '../../ui/haptic';

// 6자리 번호 쓰기(역할에 묶이지 않음, 큰 키패드). 제출 버튼은 화면의 하단 고정 영역에 둔다.
export function CodeEntry({value, onChange, keyHeight, groupLabel, belowCells, groupRef, foldGap, onRowLayout}: {value: string; onChange: (next: string) => void; keyHeight?: number; groupLabel?: string; belowCells?: React.ReactNode; groupRef?: RefObject<React.ComponentRef<typeof View> | null>; foldGap?: {before: number; h: number}; onRowLayout?: (row: number, y: number, h: number) => void}) {
  return (
    <CodeInput
      value={value}
      // UX U9: 키를 누를 때마다 짧은 시스템 촉각(눌렸는지 확신, 중복 입력 줄이기). 소리 없음
      onDigit={d => {
        hapticKeyTap();
        onChange(inputDigit(value, d));
      }}
      onDelete={() => {
        hapticKeyTap();
        onChange(deleteOne(value));
      }}
      onClear={() => {
        hapticKeyTap();
        onChange(clearAll());
      }}
      keyHeight={keyHeight}
      groupLabel={groupLabel}
      belowCells={belowCells}
      groupRef={groupRef}
      foldGap={foldGap}
      onRowLayout={onRowLayout}
    />
  );
}
