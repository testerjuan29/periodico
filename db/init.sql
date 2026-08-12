-- =====================================================
--  Periódico Automático — schema inicial
-- =====================================================
--  Este script se ejecuta automáticamente al primer
--  arranque del contenedor postgres (docker-entrypoint).
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Base de datos separada para N8N (misma instancia)
SELECT 'CREATE DATABASE n8n'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n')\gexec

-- =====================================================
--  Tabla principal
-- =====================================================
CREATE TABLE IF NOT EXISTS publications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ingesta
  source_type     TEXT NOT NULL CHECK (source_type IN ('email','whatsapp')),
  source_raw      JSONB NOT NULL,
  source_sender   TEXT,
  source_subject  TEXT,
  source_text     TEXT,
  source_media    JSONB,                    -- array de URLs de adjuntos originales
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contenido generado por IA
  wp_title        TEXT,
  wp_body_html    TEXT,
  wp_excerpt      TEXT,
  wp_category     TEXT,          -- legacy, mantenida por compatibilidad
  wp_categories   TEXT[],         -- categorías reales del cliente (múltiples)
  wp_tags         TEXT[],         -- etiquetas WordPress (Nombres Propios)
  fb_caption      TEXT,
  ig_caption      TEXT,
  hashtags        TEXT[],         -- hashtags SOLO para Instagram
  wp_subtitle     TEXT,           -- bajada editorial (solo backoffice, no va a WP)
  seo_keyphrase   TEXT,           -- frase clave principal (estilo Yoast)
  seo_keywords    TEXT[],         -- palabras clave SEO
  tw_caption      TEXT,           -- post para Twitter/X (copiar manual)
  share_text      TEXT,           -- texto para grupos de WhatsApp/Telegram (copiar manual)

  -- Imagen generada
  image_url       TEXT,
  image_meta      JSONB,

  -- Estado de aprobación
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'draft',        -- WA: recibiendo mensajes, espera comando LISTO del reportero
                    'pending',      -- esperando aprobación
                    'approved',     -- aprobada, se publica ya
                    'scheduled',    -- aprobada, se publica en scheduled_at
                    'publishing',   -- N8N está publicando ahora
                    'published',    -- ok en las 3 plataformas
                    'partial',      -- ok en algunas, error en otras
                    'failed',       -- error total
                    'rejected'      -- el cliente descartó
                  )),
  scheduled_at    TIMESTAMPTZ,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  rejected_reason TEXT,

  -- Resultados de publicación (una fila por publicación, un id por plataforma)
  wp_post_id      TEXT,
  wp_post_url     TEXT,
  fb_post_id      TEXT,
  fb_post_url     TEXT,
  ig_post_id      TEXT,
  ig_post_url     TEXT,
  publish_errors  JSONB,
  published_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publications_status         ON publications(status);
CREATE INDEX IF NOT EXISTS idx_publications_received_at    ON publications(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_publications_scheduled_due  ON publications(scheduled_at) WHERE status = 'scheduled';
-- Búsqueda rápida de draft abierto para un sender de WhatsApp (usado por workflow 02)
CREATE INDEX IF NOT EXISTS idx_publications_draft_sender   ON publications(source_sender, received_at DESC) WHERE status = 'draft';

-- Trigger simple para mantener updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publications_updated_at ON publications;
CREATE TRIGGER trg_publications_updated_at
  BEFORE UPDATE ON publications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
--  Usuarios del backoffice (login por magic link)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  role       TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','approver','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
--  Audit log — quién hizo qué
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID REFERENCES publications(id) ON DELETE CASCADE,
  actor_email    TEXT,
  action         TEXT NOT NULL,
  payload        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_publication ON audit_log(publication_id);
