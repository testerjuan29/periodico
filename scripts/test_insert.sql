-- Publicación de prueba con contexto dominicano (Abinader, INFOTEP, provincias)
-- Sirve para validar el nuevo prompt de DeepSeek: apertura "Santo Domingo. –",
-- múltiples categorías (Actualidad, Nacionales, Barahona, Azua, Bahoruco),
-- y tags con nombres propios (Luis Abinader, INFOTEP, Rafael Ovalles).

INSERT INTO publications (source_type, source_raw, source_sender, source_subject, source_text)
VALUES (
  'email',
  '{}'::jsonb,
  'redaccion@paginauno.do',
  'INFOTEP anuncia 500 becas nuevas',
  $$El presidente Luis Abinader anunció esta mañana desde el Palacio Nacional en Santo Domingo que el INFOTEP ofrecerá 500 nuevas becas para cursos técnicos en las provincias de Barahona, Azua y Bahoruco. El programa tendrá una inversión de 45 millones de pesos y estará dirigido a jóvenes entre 18 y 25 años. Las inscripciones abren el 1 de agosto en las oficinas regionales. El director del INFOTEP, Rafael Ovalles, destacó que las cifras superan lo prometido en la Estrategia Nacional de Empleo.$$
)
RETURNING id;
