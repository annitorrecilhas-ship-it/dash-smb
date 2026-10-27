#!/usr/bin/env node
// Converte o resultado da consulta "casos fora do SLA" da Maynara (Databricks, salvo em arquivo) em raw/maynara_fora.json.
// Aceita os dois formatos do conector: data_array (string_value/null_value) e data_typed_array (str / {}).
// Remove do nome do cliente sequências de números (CPF/CNPJ), porque o painel é público.
// Uso: node scripts/databricks_fora.js <arquivo do resultado>
'use strict';
const fs = require('fs');
const path = require('path');
const f = process.argv[2];
if (!f) { console.error('uso: node scripts/databricks_fora.js <arquivo>'); process.exit(1); }
const j = JSON.parse(fs.readFileSync(f, 'utf8'));
const man = j.manifest || {};
if (j.truncated || man.truncated) { console.error('resultado truncado: refaça a consulta'); process.exit(1); }
const cols = man.schema.columns.map((c) => c.name);
const res = j.result || {};
const lines = res.data_array || res.data_typed_array || [];
const val = (v) => (v == null ? null : 'string_value' in v ? v.string_value : 'str' in v ? v.str : null);
let limpos = 0;
const rows = lines.map((r) => {
  const o = {};
  r.values.forEach((v, i) => { o[cols[i]] = val(v); });
  if (o.dia_semana != null) o.dia_semana = +o.dia_semana;
  if (o.cliente && /\d{6,}/.test(o.cliente)) { o.cliente = o.cliente.replace(/[\d.\-\/]{6,}/g, '').replace(/\s+/g, ' ').trim() || null; limpos++; }
  return o;
});
const total = man.total_row_count != null ? man.total_row_count : j.total_row_count;
if (total != null && total !== rows.length) { console.error(`linhas: ${rows.length} de ${total} — resultado incompleto`); process.exit(1); }
const out = path.join(__dirname, '..', 'raw', 'maynara_fora.json');
fs.writeFileSync(out, JSON.stringify(rows));
const por = {};
for (const r of rows) { const k = (r.entrada || '').slice(0, 7); por[k] = (por[k] || 0) + 1; }
console.log(`${rows.length} casos fora do SLA → ${out}`);
console.log('por mês de entrada:', por, '| sem cliente:', rows.filter((r) => !r.cliente).length, '| documentos removidos do nome:', limpos);
