import {offlineMessage, Message} from '../copy/copy';
import {isOffline} from '../features/types';

// 자녀 화면 오류: 인터넷 문제는 공통 오프라인 문구(S1), 그 밖은 화면별 확정 문구.
export const childErrorMessage = (e: unknown, fallback: Message): Message => (isOffline(e) ? offlineMessage : fallback);
