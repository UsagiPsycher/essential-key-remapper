@echo off
rem Builds the companion APK, embeds it, then builds the portable Windows exe.
rem Needs: Android SDK + JDK 17+ (JAVA_HOME), Rust (MSVC), Node.js.
setlocal
cd /d "%~dp0"
if "%JAVA_HOME%"=="" if exist "C:\Program Files\Android\Android Studio\jbr" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

pushd android
call gradlew.bat assembleRelease --console=plain || exit /b 1
popd
copy /y android\app\build\outputs\apk\release\app-release.apk desktop\src-tauri\companion\companion.apk >nul || exit /b 1

pushd desktop
if not exist node_modules call npm ci || exit /b 1
call npx tauri build --no-bundle || exit /b 1
popd
echo.
echo Built: desktop\src-tauri\target\release\essential-key-remapper.exe
