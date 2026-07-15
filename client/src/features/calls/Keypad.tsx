/** The 12 DTMF keys, with the letters phone menus refer to ("press 2 for sales"). */
const KEYS: { digit: string; letters?: string }[] = [
  { digit: '1' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*' },
  { digit: '0', letters: '+' },
  { digit: '#' },
];

/**
 * A phone keypad. Used both to compose a number before dialling and to send
 * DTMF tones during a call (IVR menus: "press 1 for reception").
 */
export function Keypad({
  onPress,
  disabled,
  size = 'md',
}: {
  onPress: (digit: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? 'py-2' : 'py-3';
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map(({ digit, letters }) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => onPress(digit)}
          aria-label={`Key ${digit}`}
          className={`flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white ${pad} leading-none transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700`}
        >
          <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">{digit}</span>
          {letters && (
            <span className="mt-0.5 text-[9px] font-medium tracking-wider text-slate-400 dark:text-slate-500">
              {letters}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export const KEYPAD_DIGITS = KEYS.map((k) => k.digit);
