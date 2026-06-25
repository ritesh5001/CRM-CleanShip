import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export type Disposition =
  | 'interested'
  | 'callback'
  | 'not_interested'
  | 'busy'
  | 'switched_off'
  | 'wrong_number'
  | 'dnd'
  | 'converted';

export const DISPOSITIONS: Disposition[] = [
  'interested',
  'callback',
  'not_interested',
  'busy',
  'switched_off',
  'wrong_number',
  'dnd',
  'converted',
];

/** Maps a call disposition to the resulting lead status. */
export const DISPOSITION_TO_LEAD_STATUS: Record<Disposition, string> = {
  interested: 'interested',
  callback: 'callback',
  not_interested: 'not_interested',
  busy: 'in_progress',
  switched_off: 'in_progress',
  wrong_number: 'not_interested',
  dnd: 'dnd',
  converted: 'converted',
};

const callLogSchema = new Schema(
  {
    lead: { type: Types.ObjectId, ref: 'Lead', required: true, index: true },
    telecaller: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    disposition: { type: String, enum: DISPOSITIONS, required: true },
    notes: { type: String, default: '' },
    durationSec: { type: Number, default: 0, min: 0 },
    nextFollowUpAt: { type: Date },
    // Twilio call correlation (set when the call was placed via the browser softphone).
    twilioCallSid: { type: String, index: true },
    recordingUrl: { type: String },
  },
  { timestamps: true }
);

callLogSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    return ret;
  },
});

export type CallLogAttrs = InferSchemaType<typeof callLogSchema>;
export type CallLogDoc = HydratedDocument<CallLogAttrs>;

export const CallLog = model('CallLog', callLogSchema);
