// The shared voice of the app's forms and rows (tickets 27/28): the chip,
// button and ruled-field classes the expense sheet and the managers all
// speak. One definition here so the anatomy never drifts between islands.

export const CHIP_CLASS =
  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[13.5px]";
export const CHIP_QUIET = "border-rule bg-paper text-ink";
export const CHIP_PRESSED = "border-accent bg-accent-soft text-accent";
export const OPTION_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px]";

export const BTN_GHOST =
  "rounded-full border border-rule px-5 py-2.5 text-[14px] font-semibold text-ink-muted hover:text-ink";
export const BTN_PRIMARY =
  "rounded-full bg-accent px-6 py-2.5 text-[14px] font-semibold text-white hover:brightness-110 disabled:opacity-60";
export const BTN_DANGER =
  "rounded-full bg-danger px-6 py-2.5 text-[14px] font-semibold text-white hover:brightness-110 disabled:opacity-60";

export const FIELD_CLASS = "border-b border-rule py-3";
export const LABEL_CLASS = "mb-1.5 block text-[12px] text-ink-muted";
export const INPUT_CLASS =
  "w-full border-0 bg-transparent p-0 text-[16px] outline-none placeholder:text-ink-muted/70";
export const PICKER_INPUT_CLASS =
  "w-[128px] cursor-pointer rounded-lg border border-rule bg-paper px-3 py-1.5 text-[13.5px] outline-none";
