import { useState } from 'react';
import { UploadCloud, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Label, Select } from '@/components/ui/Field';
import { useImportLeads } from '@/api/leads';
import { useTelecallers } from '@/api/users';
import { apiError } from '@/api/client';
import { downloadImportTemplate } from '@/lib/csv';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: Props) {
  const importLeads = useImportLeads();
  const { data: telecallers } = useTelecallers({ isActive: 'true', limit: 100 }, { enabled: open });
  const [file, setFile] = useState<File | null>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [result, setResult] = useState<{ totalRows: number; successCount: number; errorCount: number } | null>(
    null
  );

  async function handleImport() {
    if (!file) return toast.error('Choose a file first');
    try {
      const res = await importLeads.mutateAsync({ file, assignedTo: assignedTo || undefined });
      setResult(res);
      toast.success(`Imported ${res.successCount} leads`);
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  function reset() {
    setFile(null);
    setAssignedTo('');
    setResult(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={reset}
      title="Import leads"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={reset}>
            Close
          </Button>
          {!result && (
            <Button onClick={handleImport} loading={importLeads.isPending}>
              Import
            </Button>
          )}
        </div>
      }
    >
      {result ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-emerald-700">Import complete ✅</p>
          <p>Total rows: {result.totalRows}</p>
          <p>Imported: {result.successCount}</p>
          <p>Errors/skipped: {result.errorCount}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              New here? Download the template, fill it in, then upload it.
            </span>
            <Button size="sm" variant="secondary" onClick={() => downloadImportTemplate()}>
              <Download size={14} /> Template
            </Button>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 hover:border-brand-400 dark:border-slate-600">
            <UploadCloud className="text-slate-400 dark:text-slate-500" size={28} />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {file ? file.name : 'Click to choose a CSV or Excel file'}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Recognized columns: Name, Phone, Alt Phone, Alt Phone 2, Email, Title, Company, City, State, Country,
            Source, Industry, Notes. Only Name &amp; Phone are required.
          </p>
          <div>
            <Label>Assign all to (optional)</Label>
            <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Leave unassigned</option>
              {telecallers?.data.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}
    </Modal>
  );
}
