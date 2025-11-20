export const MIDI_STATUS = {
    NOTE_ON: 0x90,
    NOTE_OFF: 0x80,
    CONTROL_CHANGE: 0xB0,
} as const;

export const MIDI_OUTPUT_STATUS = {
    NOTE_ON: 0x96,
    NOTE_OFF: 0x80,
} as const;

export const NOTE_RANGES = {
    GRID: { START: 0, END: 63 },
    FADER_BUTTONS: { START: 100, END: 107 },
    SIDE_BUTTONS: { START: 112, END: 119 },
    FADERS: { START: 48, END: 56 },
    FADER_BUTTON_8: 122,
} as const;

export const GRID_ROWS = 8;
export const GRID_COLS = 8;
