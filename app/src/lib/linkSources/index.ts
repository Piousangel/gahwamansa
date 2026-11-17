// 앱(RN) 쪽 진입점. RN 에 의존한다(./native). 토스·contracts·서버 공유 코드는 './inviteCode' 만 import 한다.
export * from './inviteCode';
export {consumeInvite, readInstallReferrerOnce, startInviteSources, subscribeInvite, type InviteBanner} from './native';
