import {summarizeCheer} from '../src/features/home/cheerLogic';

const row = (title: string, outcome: Parameters<typeof summarizeCheer>[0][number]['outcome']) => ({parentId: title, title, outcome});

test('응원 결과 정리: 모두 성공·부분 성공·하루 한도·오프라인·연결 변화', () => {
  expect(summarizeCheer([row('엄마', 'ok'), row('아빠', 'ok')])).toEqual({kind: 'sent', titles: ['엄마', '아빠'], retry: false, reload: false});
  expect(summarizeCheer([row('엄마', 'ok'), row('아빠', 'offline')])).toEqual({kind: 'partial', titles: ['엄마'], retry: true, reload: false});
  expect(summarizeCheer([row('엄마', 'ok'), row('아빠', 'daily_limit')])).toMatchObject({kind: 'partial', retry: false});
  expect(summarizeCheer([row('엄마', 'daily_limit')])).toMatchObject({kind: 'daily_limit', retry: false});
  expect(summarizeCheer([row('엄마', 'daily_limit'), row('아빠', 'offline')])).toMatchObject({kind: 'offline', retry: true});
  expect(summarizeCheer([row('엄마', 'server')])).toMatchObject({kind: 'server', retry: true});
  expect(summarizeCheer([row('엄마', 'ok'), row('아빠', 'disconnected')])).toMatchObject({kind: 'partial', reload: true});
});
