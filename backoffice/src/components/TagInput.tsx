'use client';

import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function TagInput({ value, onChange, placeholder = 'Agregar y Enter', disabled = false }: Readonly<Props>) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (value.includes(t)) {
      setDraft('');
      return;
    }
    onChange([...value, t]);
    setDraft('');
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value.length - 1);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded border border-divider bg-surface p-2',
        'focus-within:border-ink focus-within:ring-1 focus-within:ring-ink',
        disabled && 'opacity-40'
      )}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded bg-subtle px-2 py-0.5 text-meta text-ink"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded-full text-muted hover:bg-divider hover:text-ink"
              aria-label={`Eliminar ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => draft && add(draft)}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={disabled}
        className="min-w-[8rem] flex-1 border-none bg-transparent text-meta text-ink placeholder:text-muted focus:outline-none"
      />
    </div>
  );
}
