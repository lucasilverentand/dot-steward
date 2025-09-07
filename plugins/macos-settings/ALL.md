Here’s a compact reference you can drop into docs. It lists every `system.defaults.*` option from `nix-darwin` and what values they accept. Types map to `defaults` flags: **bool → `-bool`**, **int → `-int`**, **float → `-float`**, **string/enum → `-string`**. The corresponding macOS domains are noted where stable.

---

# macOS “defaults” from `nix-darwin/modules/system/defaults`

> Source of truth for names, types, and allowed values: nix-darwin manual. ([nix-darwin.github.io][1])

## NSGlobalDomain  *(domain: `NSGlobalDomain` or `-g`)*

* `AppleICUForce24HourTime`: bool
* `AppleInterfaceStyle`: enum `"Dark"` or unset (delete to force Light)
* `AppleInterfaceStyleSwitchesAutomatically`: bool
* `AppleKeyboardUIMode`: enum `0|2|3`
* `AppleMeasurementUnits`: enum `"Centimeters"|"Inches"`
* `AppleMetricUnits`: enum `0|1`
* `ApplePressAndHoldEnabled`: bool
* `AppleScrollerPagingBehavior`: bool
* `AppleShowAllExtensions`: bool
* `AppleShowAllFiles`: bool
* `AppleShowScrollBars`: enum `"WhenScrolling"|"Automatic"|"Always"`
* `AppleSpacesSwitchOnActivate`: bool
* `AppleTemperatureUnit`: enum `"Celsius"|"Fahrenheit"`
* `AppleWindowTabbingMode`: enum `"manual"|"always"|"fullscreen"`
* `InitialKeyRepeat`: int
* `KeyRepeat`: int
* `NSAutomaticCapitalizationEnabled`: bool
* `NSAutomaticDashSubstitutionEnabled`: bool
* `NSAutomaticInlinePredictionEnabled`: bool
* `NSAutomaticQuoteSubstitutionEnabled`: bool
* `NSAutomaticSpellingCorrectionEnabled`: bool
* `NSAutomaticWindowAnimationsEnabled`: bool
* `NSDisableAutomaticTermination`: bool
* `NSNavPanelExpandedStateForSaveMode`: bool
* `NSNavPanelExpandedStateForSaveMode2`: bool
* `NSScrollAnimationEnabled`: bool
* `NSTableViewDefaultSizeMode`: enum `1|2|3`
* `NSTextShowsControlCharacters`: bool
* `NSUseAnimatedFocusRing`: bool
* `NSWindowResizeTime`: float
* `NSWindowShouldDragOnGesture`: bool
* `PMPrintingExpandedStateForPrint`: bool
* `_HIHideMenuBar`: bool
* `"com.apple.keyboard.fnState"`: bool
* `"com.apple.mouse.tapBehavior"`: enum `1`
* `"com.apple.sound.beep.feedback"`: int `0|1`
* `"com.apple.sound.beep.volume"`: float `0.0..1.0`
* `"com.apple.springing.enabled"`: bool
* `"com.apple.swipescrolldirection"`: bool
* `"com.apple.trackpad.enableSecondaryClick"`: bool
* `"com.apple.trackpad.forceClick"`: bool

## Dock  *(domain: `com.apple.dock`)*  ([nix-darwin.github.io][1])

* `enable-spring-load-actions-on-all-items`: bool
* `appswitcher-all-displays`: bool
* `autohide`: bool
* `autohide-delay`: float
* `autohide-time-modifier`: float
* `dashboard-in-overlay`: bool
* `expose-animation-duration`: float
* `expose-group-apps`: bool
* `largesize`: int `16..128`
* `launchanim`: bool
* `magnification`: bool
* `mineffect`: enum `"genie"|"suck"|"scale"`
* `minimize-to-application`: bool
* `mouse-over-hilite-stack`: bool
* `mru-spaces`: bool
* `orientation`: enum `"bottom"|"left"|"right"`
* `persistent-apps`: list of entries:

  * `{ app = "/path/App.app"; }`
  * `{ file = "/path/file"; }`
  * `{ folder = "/path/folder"; }`
  * `{ spacer.small = <bool>; }`
* `persistent-others`: list of `"/path"`
* `scroll-to-open`: bool
* `show-process-indicators`: bool
* `show-recents`: bool
* `showhidden`: bool
* `slow-motion-allowed`: bool
* `static-only`: bool
* `tilesize`: int
* `wvous-bl-corner|wvous-br-corner|wvous-tl-corner|wvous-tr-corner`: hot-corner code `1,2,3,4,5,6,7,10,11,12,13,14`

## Finder  *(domain: `com.apple.finder`)*  ([nix-darwin.github.io][1])

* `AppleShowAllExtensions`: bool
* `AppleShowAllFiles`: bool
* `CreateDesktop`: bool
* `FXDefaultSearchScope`: string (e.g. `"SCcf"`)
* `FXEnableExtensionChangeWarning`: bool
* `FXPreferredViewStyle`: string `"icnv"|"Nlsv"|"clmv"|"Flwv"`
* `FXRemoveOldTrashItems`: bool
* `NewWindowTarget`: enum `"Computer"|"OS volume"|"Home"|"Desktop"|"Documents"|"Recents"|"iCloud Drive"|"Other"`
* `NewWindowTargetPath`: string URI (used when target is `"Other"`)
* `QuitMenuItem`: bool
* `ShowExternalHardDrivesOnDesktop`: bool
* `ShowHardDrivesOnDesktop`: bool
* `ShowMountedServersOnDesktop`: bool
* `ShowPathbar`: bool
* `ShowRemovableMediaOnDesktop`: bool
* `ShowStatusBar`: bool
* `_FXShowPosixPathInTitle`: bool
* `_FXSortFoldersFirst`: bool
* `_FXSortFoldersFirstOnDesktop`: bool

## Control Center  *(domain: `com.apple.controlcenter`)*

* `FocusModes`: int `18` show, `24` hide
* `NowPlaying`: int `18` show, `24` hide
* `Sound`: int `18` show, `24` hide

> These are per-host keys. Use `defaults -currentHost write com.apple.controlcenter <Key> -int 18|24`. ([nix-darwin.github.io][1], [Christian Emmer][2])

## Menu Bar Clock  *(domain: `com.apple.menuextra.clock`)*  ([nix-darwin.github.io][1])

* `Show24Hour`: bool
* `ShowAMPM`: bool
* `ShowDate`: enum `0|1|2`
* `ShowDayOfMonth`: bool
* `ShowDayOfWeek`: bool
* `ShowSeconds`: bool
* `FlashDateSeparators`: bool
* `IsAnalog`: bool

## Screencapture  *(domain: `com.apple.screencapture`)*  ([nix-darwin.github.io][1])

* `disable-shadow`: bool
* `include-date`: bool
* `location`: string path
* `show-thumbnail`: bool
* `target`: enum `"file"|"clipboard"|"preview"|"mail"|"messages"`
* `type`: string image format (e.g. `"png"`, `"jpg"`)

## Screensaver  *(domain: `com.apple.screensaver`)*  ([nix-darwin.github.io][1])

* `askForPassword`: bool
* `askForPasswordDelay`: int seconds

## WindowManager  *(domain: `com.apple.WindowManager`)*  ([nix-darwin.github.io][1])

* `EnableTilingOptionAccelerator`: bool
* `EnableTopTilingByEdgeDrag`: bool
* `GloballyEnabled`: bool
* `HideDesktop`: bool
* `StageManagerHideWidgets`: bool
* `StandardHideDesktopIcons`: bool

## Login Window  *(domain: `com.apple.loginwindow`)*  ([nix-darwin.github.io][1])

* `DisableConsoleAccess`: bool
* `GuestEnabled`: bool
* `LoginwindowText`: string
* `PowerOffDisabledWhileLoggedIn`: bool
* `RestartDisabled`: bool
* `RestartDisabledWhileLoggedIn`: bool
* `SHOWFULLNAME`: bool
* `ShutDownDisabled`: bool
* `ShutDownDisabledWhileLoggedIn`: bool
* `SleepDisabled`: bool
* `autoLoginUser`: string

## Spaces  *(domain: `com.apple.spaces`)*

* `spans-displays`: bool

  * `false` = separate Spaces per display (macOS default)
  * `true` = one Space spans all displays

> Requires logout to take effect. ([nix-darwin.github.io][1], [macOS defaults][3])

## Trackpad  *(applied across AppleMultitouch Trackpad domains by nix-darwin)*  ([nix-darwin.github.io][1])

* `ActuationStrength`: enum `0|1`
* `Clicking`: bool
* `Dragging`: bool
* `FirstClickThreshold`: enum `0|1|2`
* `SecondClickThreshold`: enum `0|1|2`
* `TrackpadRightClick`: bool
* `TrackpadThreeFingerDrag`: bool
* `TrackpadThreeFingerTapGesture`: enum `0|2`

## Universal Access  *(domain: `com.apple.universalaccess`)*  ([nix-darwin.github.io][1])

* `closeViewZoomFollowsFocus`: bool
* `mouseDriverCursorSize`: float (1 normal … 4 max)

## Magic Mouse  *(applied to AppleMultitouch Mouse domains by nix-darwin)*  ([nix-darwin.github.io][1])

* `MouseButtonMode`: enum `"OneButton"|"TwoButton"`

## iCal  *(domain: `com.apple.iCal`)*  ([nix-darwin.github.io][1])

* `CalendarSidebarShown`: bool
* `"TimeZone support enabled"`: bool
* `"first day of week"`: enum `"System Setting"|Sun|Mon|Tue|Wed|Thu|Fri|Sat`

## LaunchServices  *(domain: `com.apple.LaunchServices`)*  ([nix-darwin.github.io][1])

* `LSQuarantine`: bool

## SMB  *(domain: SMB preferences)*  ([nix-darwin.github.io][1])

* `NetBIOSName`: string
* `ServerDescription`: string

## Activity Monitor  *(domain: `com.apple.ActivityMonitor`)*  ([nix-darwin.github.io][1])

* `IconType`: int `0|2|3|5|6`

## Custom preferences passthrough  *(multiple domains)*  ([nix-darwin.github.io][1])

* `system.defaults.CustomUserPreferences` and `system.defaults.CustomSystemPreferences` accept arbitrary `{ "<domain>" = { "<Key>" = <value>; ... }; }`.

---

## CLI mapping examples

```bash
# NSGlobalDomain examples
defaults write -g AppleShowAllExtensions -bool true
defaults write -g AppleWindowTabbingMode -string "always"

# Dock examples
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock mineffect -string "scale"
defaults write com.apple.dock wvous-tr-corner -int 13

# Finder examples
defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"
defaults write com.apple.finder NewWindowTarget -string "Home"

# Control Center (per-host)
defaults -currentHost write com.apple.controlcenter Sound -int 18

# Screencapture
defaults write com.apple.screencapture target -string "clipboard"
defaults write com.apple.screencapture include-date -bool false
```

If you want this exported as a Markdown or JSON file, say the format and I’ll generate it.

[1]: https://nix-darwin.github.io/nix-darwin/manual/ "nix-darwin Configuration Options"
[2]: https://emmer.dev/blog/automate-your-macos-defaults/?utm_source=chatgpt.com "Automate Your macOS Default Settings"
[3]: https://macos-defaults.com/mission-control/spans-displays.html?utm_source=chatgpt.com "Displays have separate Spaces | Mission Control"
