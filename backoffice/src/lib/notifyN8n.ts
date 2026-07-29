export async function notifyN8n(payload: Record<string, unknown>) {
  const url = process.env.N8N_APPROVAL_WEBHOOK;
  if (!url) {
    console.warn('N8N_APPROVAL_WEBHOOK not set — skipping notification', payload);
    return;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error('N8N notify failed', res.status, await res.text());
  } catch (err) {
    console.error('N8N notify error', err);
  }
}
