'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Quote, List, ListOrdered, Undo, Redo } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  className?: string;
};

export function RichTextEditor({ value, onChange, disabled, className }: Readonly<Props>) {
  const editor = useEditor({
    extensions: [
      // Desactivamos elementos que no aplican al estilo editorial:
      // headings (regla del prompt: solo <p>), code blocks, hr.
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
      }),
    ],
    content: value,
    editable: !disabled,
    // Next.js 15 SSR: evita mismatch de hidratación.
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // Sin caja: el cuerpo se edita "dentro del artículo". El halo al pasar
        // el mouse es la afordancia de editable; el anillo azul, el foco.
        class: cn(
          'prose-editorial min-h-[220px] -mx-2 rounded-md px-2 py-1 transition-shadow',
          'hover:ring-1 hover:ring-ink/15',
          'focus:outline-none focus:ring-2 focus:ring-schedule/70',
          disabled && 'opacity-60 cursor-not-allowed',
        ),
      },
    },
  });

  // Si el prop `value` cambia externamente (ej. tras un save), sincroniza el editor
  // sin dispararle onUpdate — de lo contrario se pierde el cursor y se rompen refs.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    // Placeholder mientras tiptap hidrata en el cliente.
    return (
      <div className={className}>
        <div className="h-[220px] animate-pulse rounded-md bg-subtle" />
      </div>
    );
  }

  return (
    <div className={className}>
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, disabled }: Readonly<{ editor: Editor; disabled?: boolean }>) {
  const btn = (active: boolean) =>
    cn(
      'inline-flex h-8 w-8 items-center justify-center rounded transition-colors',
      'text-ink/70 hover:bg-subtle hover:text-ink',
      active && 'bg-ink text-paper hover:bg-ink hover:text-paper',
      disabled && 'pointer-events-none opacity-50',
    );

  return (
    // Flotante y pegajosa: acompaña el scroll sin encerrar el texto en una caja.
    <div className="sticky top-2 z-20 mb-2 inline-flex items-center gap-0.5 rounded-lg border border-divider bg-surface px-1.5 py-1 shadow-cardHover">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive('bold'))}
        title="Negrita (Ctrl+B)"
        aria-label="Negrita"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive('italic'))}
        title="Cursiva (Ctrl+I)"
        aria-label="Cursiva"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>

      <div className="mx-1 h-5 w-px bg-divider" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive('blockquote'))}
        title="Cita"
        aria-label="Cita"
      >
        <Quote className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive('bulletList'))}
        title="Lista con viñetas"
        aria-label="Lista con viñetas"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive('orderedList'))}
        title="Lista numerada"
        aria-label="Lista numerada"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>

      <div className="mx-1 h-5 w-px bg-divider" />

      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={cn(btn(false), 'disabled:opacity-30')}
        title="Deshacer (Ctrl+Z)"
        aria-label="Deshacer"
      >
        <Undo className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={cn(btn(false), 'disabled:opacity-30')}
        title="Rehacer (Ctrl+Shift+Z)"
        aria-label="Rehacer"
      >
        <Redo className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
