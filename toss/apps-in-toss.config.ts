import {defineConfig} from '@apps-in-toss/web-framework/config';

// appName은 콘솔 등록 정보와 같아야 업로드할 수 있다(임시 값, 콘솔 워크스페이스 생성 후 확정).
export default defineConfig({
  appName: 'bumo-jasik',
  permissions: [],
  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
    theme: 'light',
  },
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
  },
  webBundleDir: 'dist',
});
