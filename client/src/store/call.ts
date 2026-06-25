import { create } from 'zustand';
import { Call, Device } from '@twilio/voice-sdk';
import { fetchVoiceToken } from '@/api/calls';
import { cleanPhone } from '@/lib/format';

export type CallPhase = 'idle' | 'connecting' | 'ringing' | 'in_call' | 'ended';

/** Summary of a just-ended call, used to seed the disposition modal. */
export interface PendingDisposition {
  leadId: string;
  leadName: string;
  phone: string;
  durationSec: number;
  twilioCallSid?: string;
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
  startedAt: number | null; // epoch ms when the call was accepted
  muted: boolean;
  error: string | null;
  pending: PendingDisposition | null;

  /** Lazily create the Twilio Device (idempotent). Safe to call repeatedly. */
  initDevice: () => Promise<void>;
  startCall: (lead: { leadId: string; name: string; phone: string }) => Promise<void>;
  toggleMute: () => void;
  hangup: () => void;
  clearPending: () => void;
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
  startedAt: null,
  muted: false,
  error: null,
  pending: null,

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
      dev.on('error', (e: { message?: string }) => set({ error: e?.message ?? 'Device error' }));
      // Refresh the token shortly before it expires so the softphone stays live.
      dev.on('tokenWillExpire', async () => {
        try {
          dev.updateToken(await fetchVoiceToken());
        } catch {
          /* a failed refresh surfaces on the next call attempt */
        }
      });
      set({ device: dev, ready: true, initializing: false });
    } catch (e) {
      set({
        initializing: false,
        ready: false,
        error: e instanceof Error ? e.message : 'Failed to initialize calling',
      });
    }
  },

  startCall: async ({ leadId, name, phone }) => {
    const { phase } = get();
    if (phase !== 'idle' && phase !== 'ended') return; // a call is already in progress
    await get().initDevice();
    const device = get().device;
    if (!device) {
      set({ error: 'Calling is unavailable' });
      return;
    }

    const to = cleanPhone(phone);
    set({
      phase: 'connecting',
      leadId,
      leadName: name,
      phone: to,
      muted: false,
      startedAt: null,
      error: null,
      pending: null,
    });

    let callSid: string | undefined;
    try {
      const call = await device.connect({ params: { To: to, leadId } });

      call.on('ringing', () => set({ phase: 'ringing' }));
      call.on('accept', (c: Call) => {
        callSid = c.parameters?.CallSid ?? callSid;
        set({ phase: 'in_call', startedAt: Date.now() });
      });
      const finish = () => {
        const { startedAt, leadId: lid, leadName: lname, phone: ph } = get();
        const durationSec = startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;
        set({
          phase: 'ended',
          call: null,
          startedAt: null,
          muted: false,
          pending: lid ? { leadId: lid, leadName: lname, phone: ph, durationSec, twilioCallSid: callSid } : null,
        });
      };
      call.on('disconnect', finish);
      call.on('cancel', finish);
      call.on('error', (e: { message?: string }) => {
        set({ error: e?.message ?? 'Call error' });
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

  clearPending: () => set({ pending: null, phase: 'idle', leadId: null, leadName: '', phone: '' }),

  destroy: () => {
    const { device, call } = get();
    call?.disconnect();
    device?.destroy();
    set({ device: null, ready: false, call: null, phase: 'idle', pending: null });
  },
}));
