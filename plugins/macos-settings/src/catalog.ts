import type { CatalogRule } from "./types.ts";

// Export a catalog covering all keys from ALL.md, so callers can build
// structured configs while we keep the engine generic/DRY.
export const ALL_CATALOG: Record<
  string,
  Record<string, CatalogRule | CatalogRule[]>
> = {
  NSGlobalDomain: {
    AppleICUForce24HourTime: {
      domains: ["NSGlobalDomain"],
      key: "AppleICUForce24HourTime",
      type: "-bool",
      opts: { global: true },
    },
    AppleInterfaceStyle: {
      domains: ["NSGlobalDomain"],
      key: "AppleInterfaceStyle",
      type: "-string",
      opts: { global: true },
    },
    AppleInterfaceStyleSwitchesAutomatically: {
      domains: ["NSGlobalDomain"],
      key: "AppleInterfaceStyleSwitchesAutomatically",
      type: "-bool",
      opts: { global: true },
    },
    AppleKeyboardUIMode: {
      domains: ["NSGlobalDomain"],
      key: "AppleKeyboardUIMode",
      type: "-int",
      opts: { global: true },
    },
    AppleMeasurementUnits: {
      domains: ["NSGlobalDomain"],
      key: "AppleMeasurementUnits",
      type: "-string",
      opts: { global: true },
    },
    AppleMetricUnits: {
      domains: ["NSGlobalDomain"],
      key: "AppleMetricUnits",
      type: "-int",
      opts: { global: true },
    },
    ApplePressAndHoldEnabled: {
      domains: ["NSGlobalDomain"],
      key: "ApplePressAndHoldEnabled",
      type: "-bool",
      opts: { global: true },
    },
    AppleScrollerPagingBehavior: {
      domains: ["NSGlobalDomain"],
      key: "AppleScrollerPagingBehavior",
      type: "-bool",
      opts: { global: true },
    },
    AppleShowAllExtensions: {
      domains: ["NSGlobalDomain"],
      key: "AppleShowAllExtensions",
      type: "-bool",
      opts: { global: true },
    },
    AppleShowAllFiles: {
      domains: ["NSGlobalDomain"],
      key: "AppleShowAllFiles",
      type: "-bool",
      opts: { global: true },
    },
    AppleShowScrollBars: {
      domains: ["NSGlobalDomain"],
      key: "AppleShowScrollBars",
      type: "-string",
      opts: { global: true },
    },
    AppleSpacesSwitchOnActivate: {
      domains: ["NSGlobalDomain"],
      key: "AppleSpacesSwitchOnActivate",
      type: "-bool",
      opts: { global: true },
    },
    AppleTemperatureUnit: {
      domains: ["NSGlobalDomain"],
      key: "AppleTemperatureUnit",
      type: "-string",
      opts: { global: true },
    },
    AppleWindowTabbingMode: {
      domains: ["NSGlobalDomain"],
      key: "AppleWindowTabbingMode",
      type: "-string",
      opts: { global: true },
    },
    InitialKeyRepeat: {
      domains: ["NSGlobalDomain"],
      key: "InitialKeyRepeat",
      type: "-int",
      opts: { global: true },
    },
    KeyRepeat: {
      domains: ["NSGlobalDomain"],
      key: "KeyRepeat",
      type: "-int",
      opts: { global: true },
    },
    NSAutomaticCapitalizationEnabled: {
      domains: ["NSGlobalDomain"],
      key: "NSAutomaticCapitalizationEnabled",
      type: "-bool",
      opts: { global: true },
    },
    NSAutomaticDashSubstitutionEnabled: {
      domains: ["NSGlobalDomain"],
      key: "NSAutomaticDashSubstitutionEnabled",
      type: "-bool",
      opts: { global: true },
    },
    NSAutomaticInlinePredictionEnabled: {
      domains: ["NSGlobalDomain"],
      key: "NSAutomaticInlinePredictionEnabled",
      type: "-bool",
      opts: { global: true },
    },
    NSAutomaticQuoteSubstitutionEnabled: {
      domains: ["NSGlobalDomain"],
      key: "NSAutomaticQuoteSubstitutionEnabled",
      type: "-bool",
      opts: { global: true },
    },
    NSAutomaticSpellingCorrectionEnabled: {
      domains: ["NSGlobalDomain"],
      key: "NSAutomaticSpellingCorrectionEnabled",
      type: "-bool",
      opts: { global: true },
    },
    NSAutomaticWindowAnimationsEnabled: {
      domains: ["NSGlobalDomain"],
      key: "NSAutomaticWindowAnimationsEnabled",
      type: "-bool",
      opts: { global: true },
    },
    NSDisableAutomaticTermination: {
      domains: ["NSGlobalDomain"],
      key: "NSDisableAutomaticTermination",
      type: "-bool",
      opts: { global: true },
    },
    NSNavPanelExpandedStateForSaveMode: {
      domains: ["NSGlobalDomain"],
      key: "NSNavPanelExpandedStateForSaveMode",
      type: "-bool",
      opts: { global: true },
    },
    NSNavPanelExpandedStateForSaveMode2: {
      domains: ["NSGlobalDomain"],
      key: "NSNavPanelExpandedStateForSaveMode2",
      type: "-bool",
      opts: { global: true },
    },
    NSScrollAnimationEnabled: {
      domains: ["NSGlobalDomain"],
      key: "NSScrollAnimationEnabled",
      type: "-bool",
      opts: { global: true },
    },
    NSTableViewDefaultSizeMode: {
      domains: ["NSGlobalDomain"],
      key: "NSTableViewDefaultSizeMode",
      type: "-int",
      opts: { global: true },
    },
    NSTextShowsControlCharacters: {
      domains: ["NSGlobalDomain"],
      key: "NSTextShowsControlCharacters",
      type: "-bool",
      opts: { global: true },
    },
    NSUseAnimatedFocusRing: {
      domains: ["NSGlobalDomain"],
      key: "NSUseAnimatedFocusRing",
      type: "-bool",
      opts: { global: true },
    },
    NSWindowResizeTime: {
      domains: ["NSGlobalDomain"],
      key: "NSWindowResizeTime",
      type: "-float",
      opts: { global: true },
    },
    NSWindowShouldDragOnGesture: {
      domains: ["NSGlobalDomain"],
      key: "NSWindowShouldDragOnGesture",
      type: "-bool",
      opts: { global: true },
    },
    PMPrintingExpandedStateForPrint: {
      domains: ["NSGlobalDomain"],
      key: "PMPrintingExpandedStateForPrint",
      type: "-bool",
      opts: { global: true },
    },
    _HIHideMenuBar: {
      domains: ["NSGlobalDomain"],
      key: "_HIHideMenuBar",
      type: "-bool",
      opts: { global: true },
      restart: "SystemUIServer",
    },
    "com.apple.keyboard.fnState": {
      domains: ["NSGlobalDomain"],
      key: "com.apple.keyboard.fnState",
      type: "-bool",
      opts: { global: true },
    },
    "com.apple.mouse.tapBehavior": {
      domains: ["NSGlobalDomain"],
      key: "com.apple.mouse.tapBehavior",
      type: "-int",
      opts: { global: true, currentHost: true },
    },
    "com.apple.sound.beep.feedback": {
      domains: ["NSGlobalDomain"],
      key: "com.apple.sound.beep.feedback",
      type: "-int",
      opts: { global: true },
    },
    "com.apple.sound.beep.volume": {
      domains: ["NSGlobalDomain"],
      key: "com.apple.sound.beep.volume",
      type: "-float",
      opts: { global: true },
    },
    "com.apple.springing.enabled": {
      domains: ["NSGlobalDomain"],
      key: "com.apple.springing.enabled",
      type: "-bool",
      opts: { global: true },
    },
    "com.apple.swipescrolldirection": {
      domains: ["NSGlobalDomain"],
      key: "com.apple.swipescrolldirection",
      type: "-bool",
      opts: { global: true },
    },
    "com.apple.trackpad.enableSecondaryClick": {
      domains: ["NSGlobalDomain"],
      key: "com.apple.trackpad.enableSecondaryClick",
      type: "-bool",
      opts: { global: true },
    },
    "com.apple.trackpad.forceClick": {
      domains: ["NSGlobalDomain"],
      key: "com.apple.trackpad.forceClick",
      type: "-bool",
      opts: { global: true },
    },
  },
  Dock: {
    "enable-spring-load-actions-on-all-items": {
      domains: ["com.apple.dock"],
      key: "enable-spring-load-actions-on-all-items",
      type: "-bool",
      restart: "Dock",
    },
    "appswitcher-all-displays": {
      domains: ["com.apple.dock"],
      key: "appswitcher-all-displays",
      type: "-bool",
      restart: "Dock",
    },
    autohide: {
      domains: ["com.apple.dock"],
      key: "autohide",
      type: "-bool",
      restart: "Dock",
    },
    "autohide-delay": {
      domains: ["com.apple.dock"],
      key: "autohide-delay",
      type: "-float",
      restart: "Dock",
    },
    "autohide-time-modifier": {
      domains: ["com.apple.dock"],
      key: "autohide-time-modifier",
      type: "-float",
      restart: "Dock",
    },
    largesize: {
      domains: ["com.apple.dock"],
      key: "largesize",
      type: "-int",
      restart: "Dock",
    },
    magnification: {
      domains: ["com.apple.dock"],
      key: "magnification",
      type: "-bool",
      restart: "Dock",
    },
    mineffect: {
      domains: ["com.apple.dock"],
      key: "mineffect",
      type: "-string",
      restart: "Dock",
    },
    orientation: {
      domains: ["com.apple.dock"],
      key: "orientation",
      type: "-string",
      restart: "Dock",
    },
    "show-process-indicators": {
      domains: ["com.apple.dock"],
      key: "show-process-indicators",
      type: "-bool",
      restart: "Dock",
    },
    "show-recents": {
      domains: ["com.apple.dock"],
      key: "show-recents",
      type: "-bool",
      restart: "Dock",
    },
    tilesize: {
      domains: ["com.apple.dock"],
      key: "tilesize",
      type: "-int",
      restart: "Dock",
    },
  },
  Finder: {
    AppleShowAllFiles: {
      domains: ["com.apple.finder"],
      key: "AppleShowAllFiles",
      type: "-bool",
      restart: "Finder",
    },
    FXEnableExtensionChangeWarning: {
      domains: ["com.apple.finder"],
      key: "FXEnableExtensionChangeWarning",
      type: "-bool",
      restart: "Finder",
    },
    ShowPathbar: {
      domains: ["com.apple.finder"],
      key: "ShowPathbar",
      type: "-bool",
      restart: "Finder",
    },
    ShowStatusBar: {
      domains: ["com.apple.finder"],
      key: "ShowStatusBar",
      type: "-bool",
      restart: "Finder",
    },
  },
  "com.apple.screencapture": {
    location: {
      domains: ["com.apple.screencapture"],
      key: "location",
      type: "-string",
      restart: "SystemUIServer",
    },
    type: {
      domains: ["com.apple.screencapture"],
      key: "type",
      type: "-string",
      restart: "SystemUIServer",
    },
    "disable-shadow": {
      domains: ["com.apple.screencapture"],
      key: "disable-shadow",
      type: "-bool",
      restart: "SystemUIServer",
    },
  },
  WindowManager: {
    EnableTilingOptionAccelerator: {
      domains: ["com.apple.WindowManager"],
      key: "EnableTilingOptionAccelerator",
      type: "-bool",
    },
    EnableTopTilingByEdgeDrag: {
      domains: ["com.apple.WindowManager"],
      key: "EnableTopTilingByEdgeDrag",
      type: "-bool",
    },
    GloballyEnabled: {
      domains: ["com.apple.WindowManager"],
      key: "GloballyEnabled",
      type: "-bool",
    },
    HideDesktop: {
      domains: ["com.apple.WindowManager"],
      key: "HideDesktop",
      type: "-bool",
    },
    StageManagerHideWidgets: {
      domains: ["com.apple.WindowManager"],
      key: "StageManagerHideWidgets",
      type: "-bool",
    },
    StandardHideDesktopIcons: {
      domains: ["com.apple.WindowManager"],
      key: "StandardHideDesktopIcons",
      type: "-bool",
    },
  },
  "Login Window": {
    DisableConsoleAccess: {
      domains: ["com.apple.loginwindow"],
      key: "DisableConsoleAccess",
      type: "-bool",
    },
    GuestEnabled: {
      domains: ["com.apple.loginwindow"],
      key: "GuestEnabled",
      type: "-bool",
    },
    LoginwindowText: {
      domains: ["com.apple.loginwindow"],
      key: "LoginwindowText",
      type: "-string",
    },
    PowerOffDisabledWhileLoggedIn: {
      domains: ["com.apple.loginwindow"],
      key: "PowerOffDisabledWhileLoggedIn",
      type: "-bool",
    },
    RestartDisabled: {
      domains: ["com.apple.loginwindow"],
      key: "RestartDisabled",
      type: "-bool",
    },
    RestartDisabledWhileLoggedIn: {
      domains: ["com.apple.loginwindow"],
      key: "RestartDisabledWhileLoggedIn",
      type: "-bool",
    },
    SHOWFULLNAME: {
      domains: ["com.apple.loginwindow"],
      key: "SHOWFULLNAME",
      type: "-bool",
    },
    ShutDownDisabled: {
      domains: ["com.apple.loginwindow"],
      key: "ShutDownDisabled",
      type: "-bool",
    },
    ShutDownDisabledWhileLoggedIn: {
      domains: ["com.apple.loginwindow"],
      key: "ShutDownDisabledWhileLoggedIn",
      type: "-bool",
    },
    SleepDisabled: {
      domains: ["com.apple.loginwindow"],
      key: "SleepDisabled",
      type: "-bool",
    },
    autoLoginUser: {
      domains: ["com.apple.loginwindow"],
      key: "autoLoginUser",
      type: "-string",
    },
  },
  Spaces: {
    "spans-displays": {
      domains: ["com.apple.spaces"],
      key: "spans-displays",
      type: "-bool",
    },
  },
  Trackpad: {
    ActuationStrength: {
      domains: [
        "com.apple.AppleMultitouchTrackpad",
        "com.apple.driver.AppleBluetoothMultitouch.trackpad",
      ],
      key: "ActuationStrength",
      type: "-int",
      restart: "SystemUIServer",
    },
    Clicking: {
      domains: [
        "com.apple.AppleMultitouchTrackpad",
        "com.apple.driver.AppleBluetoothMultitouch.trackpad",
      ],
      key: "Clicking",
      type: "-bool",
      restart: "SystemUIServer",
    },
    Dragging: {
      domains: [
        "com.apple.AppleMultitouchTrackpad",
        "com.apple.driver.AppleBluetoothMultitouch.trackpad",
      ],
      key: "Dragging",
      type: "-bool",
      restart: "SystemUIServer",
    },
    FirstClickThreshold: {
      domains: [
        "com.apple.AppleMultitouchTrackpad",
        "com.apple.driver.AppleBluetoothMultitouch.trackpad",
      ],
      key: "FirstClickThreshold",
      type: "-int",
      restart: "SystemUIServer",
    },
    SecondClickThreshold: {
      domains: [
        "com.apple.AppleMultitouchTrackpad",
        "com.apple.driver.AppleBluetoothMultitouch.trackpad",
      ],
      key: "SecondClickThreshold",
      type: "-int",
      restart: "SystemUIServer",
    },
    TrackpadRightClick: {
      domains: [
        "com.apple.AppleMultitouchTrackpad",
        "com.apple.driver.AppleBluetoothMultitouch.trackpad",
      ],
      key: "TrackpadRightClick",
      type: "-bool",
      restart: "SystemUIServer",
    },
    TrackpadThreeFingerDrag: {
      domains: [
        "com.apple.AppleMultitouchTrackpad",
        "com.apple.driver.AppleBluetoothMultitouch.trackpad",
      ],
      key: "TrackpadThreeFingerDrag",
      type: "-bool",
      restart: "SystemUIServer",
    },
    TrackpadThreeFingerTapGesture: {
      domains: [
        "com.apple.AppleMultitouchTrackpad",
        "com.apple.driver.AppleBluetoothMultitouch.trackpad",
      ],
      key: "TrackpadThreeFingerTapGesture",
      type: "-int",
      restart: "SystemUIServer",
    },
  },
  "Universal Access": {
    closeViewZoomFollowsFocus: {
      domains: ["com.apple.universalaccess"],
      key: "closeViewZoomFollowsFocus",
      type: "-bool",
    },
    mouseDriverCursorSize: {
      domains: ["com.apple.universalaccess"],
      key: "mouseDriverCursorSize",
      type: "-float",
    },
  },
  "Magic Mouse": {
    MouseButtonMode: {
      domains: [
        "com.apple.AppleMultitouchMouse",
        "com.apple.driver.AppleBluetoothMultitouch.mouse",
      ],
      key: "MouseButtonMode",
      type: "-string",
    },
  },
  iCal: {
    CalendarSidebarShown: {
      domains: ["com.apple.iCal"],
      key: "CalendarSidebarShown",
      type: "-bool",
    },
    "TimeZone support enabled": {
      domains: ["com.apple.iCal"],
      key: "TimeZone support enabled",
      type: "-bool",
    },
    "first day of week": {
      domains: ["com.apple.iCal"],
      key: "first day of week",
      type: "-string",
    },
  },
  LaunchServices: {
    LSQuarantine: {
      domains: ["com.apple.LaunchServices"],
      key: "LSQuarantine",
      type: "-bool",
    },
  },
  SMB: {
    NetBIOSName: {
      domains: ["com.apple.smb.server"],
      key: "NetBIOSName",
      type: "-string",
    },
    ServerDescription: {
      domains: ["com.apple.smb.server"],
      key: "ServerDescription",
      type: "-string",
    },
  },
  "Activity Monitor": {
    IconType: {
      domains: ["com.apple.ActivityMonitor"],
      key: "IconType",
      type: "-int",
    },
  },
};

// Convenience: allow setting by ALL_CATALOG structure under `all`.
export type AllSettings = {
  [Category in keyof typeof ALL_CATALOG]?: {
    [Key in keyof (typeof ALL_CATALOG)[Category]]?: unknown;
  };
};
