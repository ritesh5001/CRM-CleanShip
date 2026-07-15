import { create } from 'zustand';
import { Call, Device } from '@twilio/voice-sdk';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { fetchVoiceToken, fetchDialStatus, type DialResult } from '@/api/calls';
import { cleanPhone } from '@/lib/format';
import { useAudioStore } from '@/store/audio';

/**
 * Point the Twilio Device at the mic/speaker chosen on the Device Test page.
 * Best-effort: a remembered device can be unplugged, and speaker selection is
 * Chromium-only — either way we fall back to the OS default rather than fail
 * the call.
 */
async function applyAudioDevices(device: Device) {
  // Only the labels persist across a reload, so re-resolve the live deviceIds
  // before dialling — otherwise a saved mic silently reverts to the default for
  // anyone who hasn't opened the Device Test page this session.
  const audio = useAudioStore.getState();
  if ((audio.inputLabel || audio.outputLabel) && !audio.inputDeviceId && !audio.outputDeviceId) {
    await audio.refreshDevices();
  }
  const { inputDeviceId, outputDeviceId } = useAudioStore.getState();
  try {
    if (inputDeviceId) await device.audio?.setInputDevice(inputDeviceId);
    else await device.audio?.unsetInputDevice();
  } catch {
    /* fall back to the default mic */
  }
  try {
    if (outputDeviceId && device.audio?.isOutputSelectionSupported) {
      await device.audio.speakerDevices.set(outputDeviceId);
    }
  } catch {
    /* fall back to the default speaker */
  }
}

export type CallPhase = 'idle' | 'connecting' | 'ringing' | 'in_call' | 'ended';
export type PhoneSlot = 'phone1' | 'phone2' | 'phone3';

/** Summary of a just-ended call, used to seed the disposition modal. */
export interface PendingDisposition {
  /** Null for a custom dial to a number that isn't a saved contact. */
  leadId: string | null;
  leadName: string;
  phone: string; // the actual number that was dialled
  phoneSlot: PhoneSlot; // which of the contact's numbers (phone1/2/3)
  durationSec: number;
  twilioCallSid?: string;
  dialStatus?: string; // completed | busy | no-answer | failed | canceled
  resultReason?: string; // human-readable reason shown to the user
}

/** Turns a Twilio dial result into a clear, human reason. */
export function dialStatusReason(status?: string | null): string | null {
  switch (status) {
    case 'busy':
      return 'The number was busy.';
    case 'no-answer':
      return 'No answer.';
    case 'failed':
      return 'Call failed — the number may be wrong or unreachable. Try updating it.';
    case 'canceled':
      return 'Call was canceled.';
    case 'completed':
      return null;
    default:
      return null;
  }
}

/** Maps Twilio Voice SDK error codes to a clear message for the telecaller. */
function friendlyDeviceError(e: { code?: number; message?: string }): string {
  switch (e.code) {
    case 31401:
      return 'Microphone permission denied. Allow mic access and try again.';
    case 31208:
      return 'Microphone permission denied. Allow mic access in your browser.';
    case 31003:
    case 31005:
      return 'Connection problem. Check your internet and try again.';
    case 20101:
    case 20104:
    case 31204:
      return 'Calling session expired. Refresh the page and try again.';
    case 31002:
      return 'Could not connect the call. The number may be invalid or not allowed.';
    case 13224:
    case 13223:
    case 21211:
      return 'Invalid phone number. Please update the number.';
    case 13227:
      return 'Calls to this country are not enabled on the Twilio account.';
    default:
      return e.message || 'Call error. Please try again.';
  }
}

interface CallState {
  device: Device | null;
  ready: boolean;
  initializing: boolean;
  call: Call | null;
  phase: CallPhase;
  leadId: string | null;
  leadName: string;
  phone: string;
  phoneSlot: PhoneSlot;
  startedAt: number | null; // epoch ms when the call was accepted
  muted: boolean;
  error: string | null;
  pending: PendingDisposition | null;
  /** DTMF digits sent during this call, e.g. "1" then "3" → "13". For the UI. */
  digitsSent: string;

  /** Lazily create the Twilio Device (idempotent). Safe to call repeatedly. */
  initDevice: () => Promise<void>;
  startCall: (lead: {
    leadId: string | null;
    name: string;
    phone: string;
    phoneSlot?: PhoneSlot;
  }) => Promise<void>;
  /** Send a DTMF tone (IVR menus: "press 1 for sales"). Only valid mid-call. */
  sendDigit: (digit: string) => void;
  toggleMute: () => void;
  hangup: () => void;
  clearPending: () => void;
  pollDialStatus: (callSid: string) => Promise<void>;
  destroy: () => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  device: null,
  ready: false,
  initializing: false,
  call: null,
  phase: 'idle',
  leadId: null,
  leadName: '',
  phone: '',
  phoneSlot: 'phone1',
  startedAt: null,
  muted: false,
  error: null,
  pending: null,
  digitsSent: '',

  initDevice: async () => {
    const { device, initializing } = get();
    if (device || initializing) return;
    set({ initializing: true, error: null });
    try {
      const token = await fetchVoiceToken();
      const dev = new Device(token, {
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        logLevel: 'error',
      });
      dev.on('error', (e: { code?: number; message?: string }) => set({ error: friendlyDeviceError(e) }));
      // Refresh the token shortly before it expires so the softphone stays live.
      dev.on('tokenWillExpire', async () => {
        try {
          dev.updateToken(await fetchVoiceToken());
        } catch {
          /* a failed refresh surfaces on the next call attempt */
        }
      });
      await applyAudioDevices(dev);
      set({ device: dev, ready: true, initializing: false });
    } catch (e) {
      set({
        initializing: false,
        ready: false,
        error: e instanceof Error ? e.message : 'Failed to initialize calling',
      });
    }
  },

  startCall: async ({ leadId, name, phone, phoneSlot = 'phone1' }) => {
    const { phase } = get();
    if (phase !== 'idle' && phase !== 'ended') return; // a call is already in progress

    const to = cleanPhone(phone);
    // Reject clearly-invalid E.164 numbers up front with a clear reason.
    if (to.startsWith('+') && !isValidPhoneNumber(to)) {
      set({ error: 'This number looks invalid. Please update it before calling.' });
      return;
    }

    await get().initDevice();
    const device = get().device;
    if (!device) {
      set({ error: 'Calling is unavailable' });
      return;
    }
    // Honour a mic/speaker change made since the Device was created.
    await applyAudioDevices(device);
    set({
      phase: 'connecting',
      leadId,
      leadName: name,
      phone: to,
      phoneSlot,
      muted: false,
      startedAt: null,
      error: null,
      pending: null,
      digitsSent: '',
    });

    let callSid: string | undefined;
    try {
      const call = await device.connect({ params: { To: to, ...(leadId ? { leadId } : {}) } });

      call.on('ringing', () => set({ phase: 'ringing' }));
      call.on('accept', (c: Call) => {
        callSid = c.parameters?.CallSid ?? callSid;
        set({ phase: 'in_call', startedAt: Date.now() });
      });
      const finish = () => {
        const { startedAt, leadId: lid, leadName: lname, phone: ph, phoneSlot: slot } = get();
        const durationSec = startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;
        set({
          phase: 'ended',
          call: null,
          startedAt: null,
          muted: false,
          // A custom dial has no leadId but still needs its outcome captured.
          pending: { leadId: lid, leadName: lname, phone: ph, phoneSlot: slot, durationSec, twilioCallSid: callSid },
        });
        // The call never connected (no talk time) → find out why from Twilio's dial result.
        if (callSid && durationSec === 0) void get().pollDialStatus(callSid);
      };
      call.on('disconnect', finish);
      call.on('cancel', finish);
      call.on('error', (e: { code?: number; message?: string }) => {
        set({ error: friendlyDeviceError(e) });
        finish();
      });

      set({ call });
    } catch (e) {
      set({
        phase: 'idle',
        call: null,
        error: e instanceof Error ? e.message : 'Could not place the call',
      });
    }
  },

  // Twilio only transmits DTMF on a connected call — pressing a key while it's
  // still ringing would be silently dropped, so ignore it rather than pretend.
  sendDigit: (digit) => {
    const { call, phase } = get();
    if (!call || phase !== 'in_call') return;
    if (!/^[0-9*#]$/.test(digit)) return;
    call.sendDigits(digit);
    set((s) => ({ digitsSent: s.digitsSent + digit }));
  },

  toggleMute: () => {
    const { call, muted } = get();
    if (!call) return;
    call.mute(!muted);
    set({ muted: !muted });
  },

  hangup: () => {
    const { call } = get();
    call?.disconnect();
  },

  // After a 0-duration call, poll Twilio's dial result (it arrives a moment later)
  // and attach a human reason to the pending disposition so the user sees why.
  pollDialStatus: async (callSid: string) => {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (get().pending?.twilioCallSid !== callSid) return; // a new call started
      let result: DialResult | null = null;
      try {
        result = await fetchDialStatus(callSid);
      } catch {
        /* keep polling */
      }
      if (result?.dialStatus) {
        const status = result.dialStatus;
        // Prefer the server's specific reason (derived from the Twilio error code,
        // e.g. "Invalid or unreachable number"); fall back to the generic status message.
        const reason = result.dialReason ?? dialStatusReason(status);
        set((st) => ({
          pending: st.pending ? { ...st.pending, dialStatus: status, resultReason: reason ?? undefined } : st.pending,
          error: reason ?? st.error,
        }));
        // For a failed dial, the specific reason (from Twilio's error alert) lands a
        // beat later — keep polling to upgrade the generic message until it arrives.
        if (status !== 'failed' || result.dialReason) return;
      }
    }
  },

  clearPending: () =>
    set({ pending: null, phase: 'idle', leadId: null, leadName: '', phone: '', error: null, digitsSent: '' }),

  destroy: () => {
    const { device, call } = get();
    call?.disconnect();
    device?.destroy();
    set({ device: null, ready: false, call: null, phase: 'idle', pending: null });
  },
}));

// Softphone state is only reachable mid-call, which makes it awkward to inspect
// when something goes wrong. Expose the store in dev builds so it can be read and
// driven from the browser console. Stripped from production bundles.
if (import.meta.env.DEV) {
  (window as unknown as { callStore?: typeof useCallStore }).callStore = useCallStore;
}
