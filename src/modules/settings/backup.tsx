import { useRef, useState } from 'preact/hooks';
import { MAX_BACKUP_BYTES, backupFilename, makeBackup, needsBackup, parseBackup, summarize, type ParseOk } from '../../state/backup';
import { markBackedUp, replaceState, requestPersistence, showToast, useStore } from '../../state/store';
import { Card, Notices, Sheet } from '../../ui/components';

const isTouch = () => typeof matchMedia === 'function' && matchMedia('(hover: none), (pointer: coarse)').matches;

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** On a phone this opens the share sheet (Save to Files, Messages, Mail); elsewhere it downloads. */
export async function exportBackup(state: Parameters<typeof makeBackup>[0]): Promise<void> {
  const file = new File([makeBackup(state)], backupFilename(), { type: 'application/json' });
  if (isTouch() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Meal plan backup' });
      markBackedUp();
      showToast('Backup saved');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        download(file);
        markBackedUp();
        showToast('Backup downloaded');
      }
    }
    return;
  }
  download(file);
  markBackedUp();
  showToast('Backup downloaded');
}

export function BackupNudge() {
  const { state } = useStore();
  if (!needsBackup(state.lastBackupAt, state.lastChangedAt)) return null;
  return (
    <div class="notice warn" role="status">
      <span class="grow">Your plan only lives in this browser. Save a fresh backup so you can't lose it.</span>
      <button type="button" class="btn" onClick={() => exportBackup(state)}>Back up</button>
    </div>
  );
}

function ImportReview({ result, onClose }: { result: ParseOk; onClose: () => void }) {
  const s = summarize(result.state);
  return (
    <Sheet title="Replace your current plan?" onClose={onClose}>
      <p>This backup has:</p>
      <ul class="progress-steps">
        <li>{s.profile ? 'A saved profile' : 'No profile details'}</li>
        <li>{s.foods} planned food{s.foods === 1 ? '' : 's'} and {s.exercises} scheduled workout{s.exercises === 1 ? '' : 's'}</li>
        <li>{s.customFoods} custom food{s.customFoods === 1 ? '' : 's'} and {s.customExercises} custom exercise{s.customExercises === 1 ? '' : 's'}</li>
      </ul>
      <Notices items={result.warnings.map((text) => ({ level: 'warn' as const, text }))} />
      <div class="row">
        <button
          type="button"
          class="btn primary grow"
          onClick={() => {
            replaceState({ ...result.state, lastBackupAt: Date.now(), lastChangedAt: Date.now() });
            requestPersistence();
            showToast('Backup imported');
            onClose();
          }}
        >
          Replace and import
        </button>
        <button type="button" class="btn subtle grow" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

export function BackupCard() {
  const { state, ui } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<ParseOk | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState('');

  const readText = (text: string) => {
    const result = parseBackup(text);
    if (result.ok) {
      setError('');
      setPasteOpen(false);
      setPasted('');
      setReview(result);
    } else {
      setError(result.error);
    }
  };

  const last = state.lastBackupAt ? new Date(state.lastBackupAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';

  return (
    <Card title="Backup & restore">
      <p class="small">Your plan is stored only in this browser on this device; nothing is sent to a server. Last backup: <b>{last}</b>.</p>
      <div class="notice info">
        <span>On iPhone, Safari can clear a site's data if you don't open it for about 7 days of browsing. Opening this app regularly avoids that. Keep a recent backup in Files or Messages in case it ever happens{ui.persisted ? '. This browser has also agreed to protect your data.' : '.'}</span>
      </div>
      <button type="button" class="btn primary block" onClick={() => exportBackup(state)}>Save a backup</button>
      <div class="row">
        <button type="button" class="btn grow" onClick={() => input.current?.click()}>Import a backup file</button>
        <button type="button" class="btn subtle grow" onClick={() => { setError(''); setPasteOpen(true); }}>Paste backup text</button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json,text/plain"
        aria-label="Backup file"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (!file) return;
          if (file.size > MAX_BACKUP_BYTES) { setError('That file is too large to be a meal plan backup.'); return; }
          readText(await file.text());
        }}
      />
      {error && <div class="notice danger" role="alert">{error}</div>}
      <p class="note">Sent a backup in Messages? Press and hold it, choose Save to Files, then import it here. Backups include everything: profile, targets, macros, plans, workouts, your own foods and exercises, yields and layout.</p>
      {review && <ImportReview result={review} onClose={() => setReview(null)} />}
      {pasteOpen && (
        <Sheet title="Paste backup text" onClose={() => setPasteOpen(false)}>
          <textarea rows={8} aria-label="Backup text" value={pasted} onInput={(e) => setPasted(e.currentTarget.value)} />
          {error && <div class="notice danger" role="alert">{error}</div>}
          <button type="button" class="btn primary block" disabled={!pasted.trim()} onClick={() => readText(pasted)}>Continue</button>
        </Sheet>
      )}
    </Card>
  );
}
