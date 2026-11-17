import React, {useState} from 'react';
import {CodeInput} from '../../ui/CodeInput';
import {BigButton} from '../../ui/BigButton';
import {canSubmit, clearAll, deleteOne, inputDigit} from '../../ui/codeInputLogic';

// 6자리 번호 쓰기(역할에 묶이지 않음): 어르신의 가족 번호, 자녀의 메일 인증번호에 같이 쓴다.
// onSubmit 이 false 를 돌려주면 입력을 비운다(틀린 번호).
type Props = {submitLabel: string; busy?: boolean; onSubmit: (code: string) => Promise<boolean | void>};

export function CodeEntry({submitLabel, busy, onSubmit}: Props) {
  const [code, setCode] = useState('');
  const submit = async () => {
    if ((await onSubmit(code)) === false) {
      setCode('');
    }
  };
  return (
    <>
      <CodeInput
        value={code}
        onDigit={d => setCode(c => inputDigit(c, d))}
        onDelete={() => setCode(deleteOne)}
        onClear={() => setCode(clearAll())}
      />
      <BigButton label={submitLabel} disabled={!canSubmit(code) || busy} onPress={submit} />
    </>
  );
}
