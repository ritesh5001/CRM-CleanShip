import { useEffect, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { useUpdateTaskStatus } from '@/api/tasks';
import { apiError } from '@/api/client';
import { fmtMinutes } from '@/lib/format';
import { localDateTimeInput } from './taskHelpers';
import type { Task } from '@/types';

interface Props {
  task: Task | null;
  onClose: () => void;
  /** Fired after a successful completion, so the caller can close a detail view too. */
  onDone?: () => void;
}

/** One-tap answers to "when did you actually do this?". */
function whenPresets(createdAt: string) {
  const created = new Date(createdAt).getTime();
  const now = new Date();

  const earlierToday = new Date(now);
  earlierToday.setHours(9, 0, 0, 0);

  const yesterdayEvening = new Date(now);
  yesterdayEvening.setDate(yesterdayEvening.getDate() - 1);
  yesterdayEvening.setHours(17, 0, 0, 0);

  return [
    { label: 'Just now', at: now },
    { label: '1 hour ago', at: new Date(now.getTime() - 60 * 60_000) },
    { label: 'Earlier today', at: earlierToday },
    { label: 'Yesterday', at: yesterdayEvening },
  ]
    // A time before the task existed can't be when it was done.
    .filter((p) => p.at.getTime() >= created - 60_000 && p.at.getTime() <= now.getTime())
    .map((p) => ({ label: p.label, value: localDateTimeInput(p.at) }));
}

const TIME_CHIPS = [15, 30, 60, 120];

export function CompleteTaskModal({ task, onClose, onDone }: Props) {
  const updateStatus = useUpdateTaskStatus();
  const [completedAt, setCompletedAt] = useState(localDateTimeInput());
  const [timeSpent, setTimeSpent] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!task) return;
    setCompletedAt(localDateTimeInput());
    setTimeSpent(task.timeSpentMin ? String(task.timeSpentMin) : '');
    setNote(task.completionNote ?? '');
    setError('');
  }, [task]);

  if (!task) return null;

  const createdAt = new Date(task.createdAt);

  async function submit() {
    if (!task) return;
    const when = new Date(completedAt);
    if (Number.isNaN(when.getTime())) return setError('Pick when you did this task.');
    if (when.getTime() > Date.now() + 60_000) return setError("That's in the future — pick a time that has already passed.");
    // 60s grace: the input is minute-precision, so "just now" on a fresh task rounds down.
    if (when.getTime() < createdAt.getTime() - 60_000) {
      return setError(`This task was only created on ${createdAt.toLocaleString()}, so it can't be done before that.`);
    }
    setError('');

    try {
      await updateStatus.mutateAsync({
        id: task._id,
        status: 'completed',
        completedAt: when.toISOString(),
        completionNote: note.trim(),
        timeSpentMin: timeSpent ? Number(timeSpent) : undefined,
      });
      toast.success('Task marked done');
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  const presets = whenPresets(task.createdAt);

  return (
    <Modal
      open
      onClose={onClose}
      title="Mark task as done"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="success" onClick={submit} loading={updateStatus.isPending}>
            <CheckCircle2 size={15} /> Mark done
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{task.title}</p>
          {task.description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{task.description}</p>}
        </div>

        <div>
          <Label htmlFor="done-at">When did you do it?</Label>
          <Input
            id="done-at"
            type="datetime-local"
            value={completedAt}
            max={localDateTimeInput()}
            onChange={(e) => setCompletedAt(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setCompletedAt(p.value)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  completedAt === p.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Defaults to right now — change it if you finished the work earlier.
          </p>
        </div>

        <div>
          <Label htmlFor="time-spent">How long did it take? (optional)</Label>
          <div className="flex items-center gap-2">
            <Clock size={14} className="shrink-0 text-slate-400" />
            <Input
              id="time-spent"
              type="number"
              min={0}
              max={1440}
              value={timeSpent}
              onChange={(e) => setTimeSpent(e.target.value)}
              placeholder="Minutes"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TIME_CHIPS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTimeSpent(String(m))}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  timeSpent === String(m)
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {fmtMinutes(m)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="done-note">Anything to report back? (optional)</Label>
          <Textarea
            id="done-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened, what's next…"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
