import {createFakeApi} from '../src/features/fakeApi';

// fake 응원 왕복(Maestro F6): 같은 fake 안에서 자녀가 보낸 응원이 어르신의 안 읽은 응원(get_my_cheers)에 쌓인다.
test('자녀가 보낸 응원은 어르신 안 읽은 응원 맨 앞에 쌓이고, 실패한 응원은 쌓이지 않는다', async () => {
  const api = createFakeApi({linked: true, cheerDailyLimit: 1});
  expect((await api.getMyCheers()).unread_count).toBe(0);
  expect((await api.sendCheer('parent-1', 'thanks_always')).ok).toBe(true);
  expect((await api.sendCheer('parent-1', 'warm_day')).ok).toBe(false); // 하루 한도
  const mine = await api.getMyCheers();
  expect(mine.unread_count).toBe(1);
  expect(mine.cheers[0].message_key).toBe('thanks_always');
  await api.markCheersRead(null);
  expect((await api.getMyCheers()).unread_count).toBe(0);
});
