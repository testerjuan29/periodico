'use client';

import { useState } from 'react';

type Props = {
  wpTitle: string | null;
  wpBodyHtml: string | null;
  wpExcerpt: string | null;
  wpCategories: string[];
  wpTags: string[];
  fbCaption: string | null;
  igCaption: string | null;
  hashtags: string[];
  imageUrl: string | null;
};

const tabs = [
  { id: 'wordpress', label: 'WordPress' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function PreviewTabs(props: Props) {
  const [active, setActive] = useState<TabId>('wordpress');
  const imgSrc = props.imageUrl
    ? `/api/image?path=${encodeURIComponent(props.imageUrl)}`
    : null;

  return (
    <div>
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-4 py-2 text-sm font-medium transition ${
              active === t.id
                ? 'border-b-2 border-brand text-brand'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {active === 'wordpress' && (
          <article className="rounded-lg border bg-white p-6 shadow-sm">
            {imgSrc && <img src={imgSrc} alt="" className="mb-6 w-full rounded" />}
            {props.wpCategories?.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {props.wpCategories.map((c) => (
                  <span key={c} className="rounded bg-brand/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-brand">
                    {c}
                  </span>
                ))}
              </div>
            )}
            <h1 className="mb-4 font-serif text-2xl font-bold">{props.wpTitle ?? '—'}</h1>
            {props.wpExcerpt && (
              <p className="mb-6 border-l-4 border-brand pl-4 text-lg italic text-gray-700">
                {props.wpExcerpt}
              </p>
            )}
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: props.wpBodyHtml ?? '' }}
            />
            {props.wpTags?.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
                <span className="text-xs font-semibold uppercase text-gray-500">Etiquetas:</span>
                {props.wpTags.map((t) => (
                  <span key={t} className="rounded border bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </article>
        )}

        {active === 'facebook' && (
          <div className="max-w-lg rounded-lg border bg-white shadow-sm">
            <div className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-full bg-brand" />
              <div>
                <div className="text-sm font-semibold">El Periódico</div>
                <div className="text-xs text-gray-500">Ahora · 🌐</div>
              </div>
            </div>
            <div className="whitespace-pre-wrap px-4 pb-3 text-sm">{props.fbCaption ?? '—'}</div>
            {imgSrc && <img src={imgSrc} alt="" className="w-full" />}
          </div>
        )}

        {active === 'instagram' && (
          <div className="max-w-md rounded-lg border bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b p-3">
              <div className="h-8 w-8 rounded-full bg-brand" />
              <div className="text-sm font-semibold">elperiodico</div>
            </div>
            {imgSrc && <img src={imgSrc} alt="" className="aspect-square w-full object-cover" />}
            <div className="p-3">
              <div className="whitespace-pre-wrap text-sm">
                <span className="font-semibold">elperiodico</span> {props.igCaption ?? '—'}
              </div>
              {props.hashtags?.length > 0 && (
                <div className="mt-2 text-sm text-blue-900">
                  {props.hashtags.map((h) => `#${h}`).join(' ')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
