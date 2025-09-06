import { z } from "zod";

// Zod schemas describing supported macOS settings
// Categories are optional; unknown keys are rejected for safety.

// Generic passthrough for any `defaults write` supported in ALL.md
export const DefaultWriteSchema = z
  .object({
    domain: z.string().min(1),
    key: z.string().min(1),
    type: z.enum(["-bool", "-int", "-float", "-string"]),
    value: z.union([z.boolean(), z.number(), z.string()]),
    opts: z
      .object({ global: z.boolean().optional(), currentHost: z.boolean().optional() })
      .optional(),
    restart: z.string().optional(),
  })
  .strict();

const MouseSchema = z
  .object({
    // com.apple.mouse.scaling (float). Typical range ~0..3; allow 0..10 to be safe.
    speed: z.number().min(0).max(10).optional(),
    // com.apple.swipescrolldirection (bool) — true = natural
    natural_scrolling: z.boolean().optional(),
    // Enable tap to click (applies to trackpads and BT trackpads)
    tap_to_click: z.boolean().optional(),
  })
  .strict();

const DockSchema = z
  .object({
    autohide: z.boolean().optional(), // com.apple.dock autohide
    tilesize: z.number().int().min(16).max(128).optional(), // com.apple.dock tilesize
    magnification: z.boolean().optional(), // com.apple.dock magnification
    largesize: z.number().int().min(16).max(256).optional(), // com.apple.dock largesize
    orientation: z.enum(["left", "bottom", "right"]).optional(), // com.apple.dock orientation
    minimize_to_application: z.boolean().optional(), // com.apple.dock minimize-to-application
    mineffect: z.enum(["genie", "scale"]).optional(), // com.apple.dock mineffect
    show_recents: z.boolean().optional(), // com.apple.dock show-recents
    autohide_delay: z.number().min(0).max(10).optional(), // com.apple.dock autohide-delay
    autohide_time: z.number().min(0).max(10).optional(), // com.apple.dock autohide-time-modifier
  })
  .strict();

const FinderSchema = z
  .object({
    show_hidden: z.boolean().optional(), // com.apple.finder AppleShowAllFiles
    show_path_bar: z.boolean().optional(), // com.apple.finder ShowPathbar
    show_status_bar: z.boolean().optional(), // com.apple.finder ShowStatusBar
    extension_change_warning: z.boolean().optional(), // com.apple.finder FXEnableExtensionChangeWarning
  })
  .strict();

const KeyboardSchema = z
  .object({
    key_repeat: z.number().int().min(1).max(120).optional(), // NSGlobalDomain KeyRepeat
    initial_key_repeat: z.number().int().min(10).max(120).optional(), // NSGlobalDomain InitialKeyRepeat
    press_and_hold: z.boolean().optional(), // NSGlobalDomain ApplePressAndHoldEnabled (true = press-and-hold)
  })
  .strict();

const ScreenshotSchema = z
  .object({
    location: z.string().min(1).optional(), // com.apple.screencapture location (path)
    type: z.enum(["png", "jpg", "tiff", "pdf", "heic"]).optional(), // com.apple.screencapture type
    disable_shadow: z.boolean().optional(), // com.apple.screencapture disable-shadow
  })
  .strict();

const GlobalSchema = z
  .object({
    // Auto-hide menu bar: NSGlobalDomain _HIHideMenuBar
    auto_hide_menu_bar: z.boolean().optional(),
    // Save to iCloud by default for new documents (false = save to disk)
    save_to_icloud_by_default: z.boolean().optional(), // NSDocumentSaveNewDocumentsToCloud
  })
  .strict();

export const MacSettingsSchema = z
  .object({
    mouse: MouseSchema.optional(),
    dock: DockSchema.optional(),
    finder: FinderSchema.optional(),
    keyboard: KeyboardSchema.optional(),
    screenshot: ScreenshotSchema.optional(),
    global: GlobalSchema.optional(),
    // Arbitrary defaults (use ALL.md as reference of supported keys)
    defaults: z.array(DefaultWriteSchema).optional(),
    // All settings by catalog (categories from ALL.md). Values are validated
    // by type at apply-time via the catalog. Keep schema permissive to avoid
    // duplicating an enormous type surface.
    all: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

export type MacSettings = z.infer<typeof MacSettingsSchema>;

