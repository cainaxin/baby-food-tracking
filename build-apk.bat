@echo off
set JAVA_HOME=D:\tools\jdk-21.0.13+9
set PATH=%JAVA_HOME%\bin;%PATH%
set ANDROID_HOME=D:\android-sdk
set ANDROID_SDK_ROOT=D:\android-sdk
cd /d D:\code\baby-food-tracker
call android\gradlew.bat -p android assembleDebug --console=plain
