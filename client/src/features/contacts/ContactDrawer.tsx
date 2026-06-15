import { useState } from 'react';
import { Phone, MessageCircle, PhoneCall, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Misc';
import { useLead, useAddRemark } from '@/api/leads';
import { apiError } from '@/api/client';
import { CallUpdateModal } from './CallUpdateModal';
import {
  CALL_STATUS_COLORS,
  CALL_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
} from '@/lib/constants';
import { fmtDateTime, telLink, whatsappLink } from '@/lib/format';
import type { CallStatus, Lead, Role } from '@/types';

interface Props {
  lead: Lead | null;
  role: Role;
  onClose: () => void;
}

export function ContactDrawer({ lead, role, onClose }: Props) {
  const fresh = useLead(lead?._id);
  const addRemark = useAddRemark();
  const [text, setText] = useState('');
  const [callOpen, setCallOpen] = useState(false);

  if (!lead) return null;
  const c = fresh.data ?? lead;
  const location = [c.city, c.state, c.country].filter(Boolean).join(', ');

  async function submitRemark() {
    if (!text.trim()) return;
    try {
      await addRemark.mutateAsync({ id: c._id, text: text.trim() });
      setText('');
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  return (
    <>
      <Modal open={!!lead} onClose={onClose} title={c.name} size="lg">
        <div className="space-y-4">
          {/* Header badges + quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={LEAD_STATUS_COLORS[c.status]}>{LEAD_STATUS_LABELS[c.status]}</Badge>
            <Badge className={CALL_STATUS_COLORS[(c.callStatus ?? 'pending') as CallStatus]}>
              {CALL_STATUS_LABELS[(c.callStatus ?? 'pending') as CallStatus]}
            </Badge>
            {c.qualified && <Badge className="bg-green-600 text-white">Lead</Badge>}
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {c.title && <Detail label="Title" value={c.title} />}
            {c.company && <Detail label="Company" value={c.company} />}
            <Detail label="Phone" value={c.phone} />
            {c.altPhone && <Detail label="Alt phone" value={c.altPhone} />}
            {c.email && <Detail label="Email" value={c.email} />}
            {location && <Detail label="Location" value={location} />}
            {c.lastContactedAt && <Detail label="Last contacted" value={fmtDateTime(c.lastContactedAt)} />}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <a href={telLink(c.phone)}>
              <Button size="sm" variant="secondary">
                <Phone size={14} /> Call
              </Button>
            </a>
            <a href={whatsappLink(c.phone)} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary">
                <MessageCircle size={14} className="text-emerald-600" /> WhatsApp
              </Button>
            </a>
            {role === 'telecaller' && (
              <Button size="sm" onClick={() => setCallOpen(true)}>
                <PhoneCall size={14} /> Update call
              </Button>
            )}
          </div>

          {/* Remarks timeline */}
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Remarks</h4>
            <div className="space-y-2">
              {(c.remarks ?? []).length === 0 && (
                <p className="text-sm text-slate-400">No remarks yet.</p>
              )}
              {(c.remarks ?? [])
                .slice()
                .reverse()
                .map((r, i) => (
                  <div key={r._id ?? i} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">{r.text}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {r.byName || 'Unknown'}
                      {r.byRole ? ` (${r.byRole === 'superadmin' ? 'Admin' : 'Telecaller'})` : ''} ·{' '}
                      {fmtDateTime(r.createdAt)}
                    </p>
                  </div>
                ))}
            </div>

            {/* Add remark (both roles) */}
            <div className="mt-3 flex gap-2">
              <Textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a remark…"
              />
              <Button onClick={submitRemark} loading={addRemark.isPending}>
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <CallUpdateModal open={callOpen} lead={c} onClose={() => setCallOpen(false)} />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-slate-400">{label}</span>
      <p className="text-slate-700">{value}</p>
    </div>
  );
}
