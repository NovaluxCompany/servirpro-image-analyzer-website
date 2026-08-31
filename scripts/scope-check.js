#!/usr/bin/env node
/**
 * 🎯 Scope Check (local)
 * Valida, ANTES de hacer commit o abrir el PR, que tus cambios locales
 * correspondan solo a los requerimientos que pegaste en SCOPE.md.
 *
 * Usa Gemini 2.5 Flash (Google AI Studio, capa gratuita sin tarjeta) para que
 * el chequeo local de front y back usen la misma key (GEMINI_API_KEY) y no
 * dependas de la API de Anthropic solo para esto. El Angular PR Review Agent
 * que corre en GitHub Actions (.github/scripts/angular-review.js) sigue
 * usando Gemini sin cambios — esto es solo para la validación rápida local.
 *
 * Uso:
 *   npm run scope-check                     # valida todo lo no commiteado (git diff HEAD)
 *   npm run scope-check -- --staged         # valida solo lo que está en stage (git add)
 *   npm run scope-check -- --base develop   # valida contra otra rama
 *   npm run scope-check -- --base HEAD~1    # valida el último commit
 *   npm run scope-check -- --requirements otra-lista.md
 *
 * Requiere GEMINI_API_KEY en el entorno (o en tu .env local).
 */

require('dotenv').config();
const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAX_DIFF_CHARS = 400000;
const MAX_OUTPUT_TOKENS = 16000;

const COLOR = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function parseArgs(argv) {
  const args = { requirements: 'SCOPE.md', mode: 'diff' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--staged') args.mode = 'staged';
    else if (argv[i] === '--base') { args.mode = 'base'; args.base = argv[++i]; }
    else if (argv[i] === '--requirements') args.requirements = argv[++i];
  }
  return args;
}

function getDiff(args) {
  let cmd;
  if (args.mode === 'staged') cmd = 'git diff --cached';
  else if (args.mode === 'base') cmd = `git diff ${args.base}...HEAD`;
  else cmd = 'git diff HEAD';
  try {
    return execSync(cmd, { maxBuffer: 1024 * 1024 * 50 }).toString('utf8');
  } catch (e) {
    console.error(`❌ No se pudo obtener el diff con "${cmd}": ${e.message}`);
    process.exit(2);
  }
}

// Si el texto trae marcadores <!-- SCOPE:START --> ... <!-- SCOPE:END -->
// (el mismo formato que usa la plantilla de PR y el bot de CI en GitHub),
// se usa SOLO lo que está entre ellos. Así el chequeo local compara contra
// exactamente el mismo texto que el bot del PR, sin el resto de la
// plantilla (encabezados, comentarios de instrucciones, "Cómo probarlo",
// etc.) que no son requerimientos y solo confunden al modelo.
function extractScopeBlock(text) {
  const match = text.match(/<!--\s*SCOPE:START\s*-->([\s\S]*?)<!--\s*SCOPE:END\s*-->/);
  if (match) {
    const inner = match[1].trim();
    if (inner.length > 0) return inner;
  }
  return text.trim();
}

function getRequirements(path) {
  let raw;
  if (path === '-') {
    raw = fs.readFileSync(0, 'utf8');
  } else {
    if (!fs.existsSync(path)) {
      console.error(`❌ No existe "${path}". Crea ese archivo en la raíz del proyecto y pega ahí, como texto, la lista de requerimientos de la tarea (o pasa --requirements <ruta>).`);
      process.exit(2);
    }
    raw = fs.readFileSync(path, 'utf8');
  }
  return extractScopeBlock(raw);
}

async function callGemini(diff, requirements) {
  const systemPrompt = `Eres un revisor de alcance (scope) muy estricto para un frontend Angular/TypeScript. Tu única tarea es comparar una lista de requerimientos con un diff de código y determinar si CADA cambio del diff está justificado por al menos uno de los requerimientos.

Un cambio está justificado si es necesario o directamente implicado por algún requerimiento (incluye tests, tipos e imports que soporten ese cambio). NO está justificado: refactors no pedidos, renombrados, cambios de estilo/formato en código no relacionado, archivos o funciones no mencionadas ni implicadas por los requerimientos, eliminación de código no relacionado, cambios de configuración o dependencias no pedidos.

Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni markdown fences, con este esquema exacto. Para que la respuesta no se corte, mantén "reason" en UNA sola frase corta (máximo ~20 palabras) por cada violación:
{
  "in_scope": true|false,
  "violations": [
    { "file": "ruta/al/archivo", "reason": "motivo breve de por qué no corresponde a ningún requerimiento" }
  ]
}`;

  const userPrompt = `## Requerimientos
---
${requirements}
---

## Diff a validar
\`\`\`diff
${diff.slice(0, MAX_DIFF_CHARS)}
\`\`\`

Evalúa el diff contra los requerimientos y responde solo con el JSON pedido. Si un archivo no aparece completo en el diff que ves, no lo reportes.`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gemini-2.5-flash',
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/openai/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]) {
            resolve({
              content: parsed.choices[0].message.content,
              finishReason: parsed.choices[0].finish_reason,
            });
          } else {
            reject(new Error(`Gemini API Error: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Si la respuesta se cortó y no es JSON válido, rescata a mano las
// violaciones que sí alcanzaron a llegar completas ({ "file": ..., "reason": ... }).
function extractPartialViolations(text) {
  const violations = [];
  const re = /\{\s*"file"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"reason"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    violations.push({ file: m[1], reason: m[2] });
  }
  return violations;
}

function printReport(result, truncated) {
  const violations = result.violations || [];
  const line = '─'.repeat(56);

  console.log('');
  console.log(`${COLOR.cyan}${line}${COLOR.reset}`);
  console.log(`${COLOR.bold}🎯 Resultado del chequeo de alcance${COLOR.reset}`);
  console.log(`${COLOR.cyan}${line}${COLOR.reset}`);

  if (truncated) {
    console.log(`${COLOR.yellow}⚠️  La respuesta del modelo se cortó — esto son resultados PARCIALES.${COLOR.reset}`);
    console.log(`${COLOR.dim}   Si necesitas la lista completa, valida contra un punto más cercano${COLOR.reset}`);
    console.log(`${COLOR.dim}   (menos commits/cambios de una vez), por ejemplo --base HEAD~1.${COLOR.reset}`);
  }

  if (!truncated && result.in_scope && violations.length === 0) {
    console.log(`\n${COLOR.green}${COLOR.bold}✅ EN ALCANCE${COLOR.reset} — todos los cambios corresponden a los requerimientos.\n`);
    return;
  }

  if (violations.length === 0) {
    console.log(`\n${COLOR.dim}No se identificó ninguna violación en la parte de la respuesta que llegó.${COLOR.reset}\n`);
    return;
  }

  console.log(`\n${COLOR.red}${COLOR.bold}❌ FUERA DE ALCANCE${COLOR.reset} — ${violations.length} cambio(s) no justificado(s):\n`);
  violations.forEach((v, i) => {
    console.log(`${COLOR.bold}${i + 1}.${COLOR.reset} ${COLOR.yellow}${v.file}${COLOR.reset}`);
    console.log(`   ${COLOR.dim}${v.reason}${COLOR.reset}`);
  });
  console.log('');
  console.log(`${COLOR.cyan}${line}${COLOR.reset}\n`);
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('❌ Falta GEMINI_API_KEY en el entorno.\n   Expórtala en tu shell (export GEMINI_API_KEY=tu_key) o agrégala a tu .env local.');
    process.exit(2);
  }

  const args = parseArgs(process.argv.slice(2));
  const requirements = getRequirements(args.requirements);
  const diff = getDiff(args);

  if (!diff.trim()) {
    if (args.mode === 'diff') {
      console.log('✅ No hay cambios sin commitear que validar.');
      console.log('   Si ya hiciste commit, compara contra otro punto con --base, por ejemplo:');
      console.log('     npm run scope-check -- --base HEAD~1        # el último commit');
      console.log('     npm run scope-check -- --base origin/master # todo lo que llevas en esta rama');
    } else {
      console.log('✅ No hay cambios que validar.');
    }
    process.exit(0);
  }

  console.log(`🎯 Validando alcance contra "${args.requirements}" (${requirements.length} caracteres de requerimientos, ${diff.length} caracteres de diff)...`);
  if (diff.length > MAX_DIFF_CHARS) {
    console.log(`${COLOR.yellow}⚠️  El diff supera ${MAX_DIFF_CHARS} caracteres; solo se envían los primeros ${MAX_DIFF_CHARS} al modelo.${COLOR.reset}`);
  }

  let response;
  try {
    response = await callGemini(diff, requirements);
  } catch (e) {
    console.error(`❌ Error consultando Gemini: ${e.message}`);
    process.exit(2);
  }
  const raw = response.content;

  let result;
  let usedFallback = false;
  try {
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    result = JSON.parse(clean);
  } catch (e) {
    const salvaged = extractPartialViolations(raw);
    if (salvaged.length > 0) {
      result = { in_scope: false, violations: salvaged };
      usedFallback = true;
    } else {
      console.error('❌ No se pudo interpretar la respuesta del modelo y no se pudo rescatar nada útil de ella:');
      console.error(raw);
      process.exit(2);
    }
  }

  const truncated = usedFallback || response.finishReason === 'length';
  printReport(result, truncated);

  const violations = result.violations || [];
  if (!truncated && result.in_scope && violations.length === 0) {
    process.exit(0);
  }
  process.exit(1);
}

main();
