# 이 프로젝트 전용 개발 환경변수. 사용: source scripts/env.sh
# ~/.zshrc 같은 전역 설정을 건드리지 않기 위해 프로젝트 안에 둔다.
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
