/**
 * 🤖 Angular PR Review Agent
 * Analiza PRs con foco en Angular best practices, calidad de código y seguridad.
 * Powered by Google AI Studio (Gemini 2.5 Flash) — Free tier, sin tarjeta de crédito
 */

const fs = require('fs');
const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;
const PR_TITLE = process.env.PR_TITLE;
const PR_AUTHOR = process.env.PR_AUTHOR;
const PR_BODY = process.env.PR_BODY || '';
const REPO = process.env.REPO;
const [OWNER, REPO_NAME] = REPO.split('/');

// ─── Leer el diff del PR ─────────────────────────────────────────────────────
function getDiff() {
  try {
    return fs.readFileSync('pr_diff_trimmed.txt', 'utf8');
  } catch {
    return 'No se pudo leer el diff del PR.';
  }
}

// ─── Chequeo determinístico: console.log prohibido ──────────────────────────
// No confiamos únicamente en el criterio del modelo para esta regla: se
// escanean las líneas añadidas del diff y, si aparece un console.log, el PR
// queda marcado como REQUEST_CHANGES sin importar lo que diga la IA.
function scanForConsoleLog(diff) {
  const findings = [];
  const lines = diff.split('\n');
  let currentFile = null;
  let newLineNumber = null;

  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      const path = line.slice(4).trim();
      currentFile = path === '/dev/null' ? null : path.replace(/^b\//, '');
      newLineNumber = null;
      continue;
    }
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/);
      newLineNumber = match ? parseInt(match[1], 10) : null;
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const isRelevantFile = currentFile && /\.(ts|html)$/.test(currentFile);
      if (isRelevantFile && /console\.log\s*\(/.test(line)) {
        findings.push({
          file: currentFile,
          line: newLineNumber,
          code: line.slice(1).trim().slice(0, 200),
        });
      }
      if (newLineNumber !== null) newLineNumber++;
    } else if (!line.startsWith('-') && !line.startsWith('\\')) {
      if (newLineNumber !== null) newLineNumber++;
    }
  }
  return findings;
}

// ─── Requerimientos del PR (para el chequeo de alcance) ──────────────────────
// Se pegan en la descripción del PR entre <!-- SCOPE:START --> y
// <!-- SCOPE:END -->. Si no hay marcadores, no se valida alcance (todo lo
// demás sigue funcionando igual, es opt-in por PR).
function extractScopeRequirements(prBody) {
  if (!prBody) return null;
  const match = prBody.match(/<!--\s*SCOPE:START\s*-->([\s\S]*?)<!--\s*SCOPE:END\s*-->/);
  const text = match ? match[1].trim() : '';
  return text.length > 0 ? text : null;
}

// ─── Llamar a Google AI Studio (Gemini 2.5 Flash) ────────────────────────────
async function callGemini(diff, scopeRequirements) {
  const systemPrompt = `Eres un revisor de código senior, experto en Angular (v17+), TypeScript y seguridad web (ethical hacking / OWASP).
Tu tarea es revisar Pull Requests exigiendo código limpio, seguro y alineado con las mejores prácticas de Angular.
Siempre respondes en español. Tu tono es profesional, directo y constructivo.

Regla no negociable: el uso de "console.log" (o cualquier variante como console.debug/console.info dejada en el código) está PROHIBIDO en código de producción. Si encuentras un console.log en el código añadido, repórtalo SIEMPRE como severity "CRITICAL" dentro de code_quality, inclúyelo en required_changes, y el verdict del PR debe ser "REQUEST_CHANGES" sin excepción, sin importar la calidad del resto del código.

${scopeRequirements ? `Regla no negociable de ALCANCE: este PR declaró una lista de requerimientos (ver más abajo, sección "Requerimientos declarados del PR"). Debes evaluar CADA archivo/cambio del diff y determinar si está justificado por al menos uno de esos requerimientos. Un cambio está justificado si es necesario o directamente implicado por algún requerimiento (incluye tests, tipos e imports que soporten ese cambio). NO está justificado: refactors no pedidos, renombrados, cambios de estilo/formato en código no relacionado, archivos o funciones no mencionadas ni implicadas por los requerimientos, eliminación de código no relacionado. Reporta cada cambio no justificado en "scope_violations" (archivo, resumen del cambio, motivo). Si encuentras alguno, el verdict debe ser "REQUEST_CHANGES" sin excepción. Si TODOS los cambios corresponden a los requerimientos, deja "scope_violations" vacío.

Regla no negociable de COBERTURA (el array es obligatorio siempre, aunque su contenido sea solo informativo y NO afecte el verdict ni cuente como motivo para REQUEST_CHANGES): cuenta cuántos puntos/tareas individuales tiene la lista de requerimientos (cada línea, viñeta o punto numerado que describa un cambio distinto — no la lista completa como un solo bloque) y devuelve en "requirements_coverage" EXACTAMENTE esa cantidad de entradas (campos: requirement, covered, note), una por cada punto, sin omitir ninguno. Esto aplica SIEMPRE, incluso si hubo violaciones de alcance, incluso si el PR no implementa todavía nada de la lista: en ese caso igual debes listar cada requerimiento con "covered": false y una nota breve de por qué no se ve implementado. NUNCA devuelvas "requirements_coverage" vacío cuando hay una lista de requerimientos declarada. Un PR puede cubrir solo una parte de la lista a propósito (trabajo dividido en varios PRs) — eso NO es un error ni debe penalizar el score ni el verdict, es puramente para que el autor vea de un vistazo qué falta.` : 'No se declararon requerimientos de alcance para este PR (no hay bloque SCOPE en la descripción), así que deja "scope_violations" y "requirements_coverage" como arreglos vacíos y no penalices por esto.'}

Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni markdown fences, siguiendo exactamente este esquema:
{
  "summary": "Resumen ejecutivo del PR en 2-3 oraciones",
  "verdict": "APPROVE | REQUEST_CHANGES | COMMENT",
  "score": <número del 1 al 10>,
  "angular_best_practices": [
    { "severity": "CRITICAL | WARNING | INFO | GOOD", "category": "categoría Angular", "issue": "descripción", "location": "archivo o línea", "recommendation": "cómo mejorar o qué está bien" }
  ],
  "code_quality": [
    { "severity": "CRITICAL | WARNING | INFO | GOOD", "category": "categoría de calidad", "issue": "descripción", "location": "archivo o línea", "recommendation": "mejora sugerida" }
  ],
  "security_alerts": [
    { "severity": "CRITICAL | HIGH | MEDIUM | LOW | NONE", "type": "tipo de vulnerabilidad", "description": "descripción detallada", "location": "archivo o línea", "mitigation": "cómo mitigarlo", "cwe_reference": "CWE-XXX si aplica, si no cadena vacía" }
  ],
  "performance_issues": [
    { "severity": "HIGH | MEDIUM | LOW", "issue": "problema de performance", "recommendation": "optimización sugerida" }
  ],
  "accessibility": [
    { "severity": "HIGH | MEDIUM | LOW", "issue": "problema de accesibilidad", "recommendation": "mejora sugerida" }
  ],
  "scope_violations": [
    { "file": "archivo con el cambio no justificado", "summary": "qué cambia ahí", "reason": "por qué no corresponde a ningún requerimiento declarado" }
  ],
  "requirements_coverage": [
    { "requirement": "texto breve del punto/tarea individual de la lista de requerimientos", "covered": true, "note": "qué archivo/cambio lo implementa, o por qué no se ve implementado todavía (vacío si covered es true y es obvio)" }
  ],
  "positive_highlights": ["aspecto positivo 1"],
  "required_changes": ["cambio obligatorio (solo si verdict es REQUEST_CHANGES)"],
  "suggested_improvements": ["mejora sugerida 1"]
}
Todos los arreglos son obligatorios en la respuesta; usa [] si no aplica.`;

  const userPrompt = `## Pull Request a revisar
**Título:** ${PR_TITLE}
**Autor:** ${PR_AUTHOR}
**PR #:** ${PR_NUMBER}
${scopeRequirements ? `
## Requerimientos declarados del PR (validar alcance)
---
${scopeRequirements}
---
` : ''}
## Diff del código
\`\`\`diff
${diff}
\`\`\`

## Instrucciones de revisión

Analiza este PR de Angular exigiendo código limpio, seguro y buenas prácticas. Devuelve un veredicto (APPROVE, REQUEST_CHANGES o COMMENT), una puntuación del 1 al 10, y listas detalladas de hallazgos.

### Checklist Angular que DEBES revisar:
- OnPush Change Detection Strategy
- TrackBy en ngFor
- Uso correcto de async pipe vs subscripciones manuales
- Unsubscribe / takeUntilDestroyed
- Lazy loading de módulos/rutas
- Standalone components (Angular 17+)
- Signals API si aplica
- Inyección de dependencias correcta (inject() function)
- Tipado estricto TypeScript (nada de "any" sin justificar)
- Nomenclatura Angular (kebab-case, PascalCase)
- Separación de responsabilidades (Smart/Dumb components)
- Evitar lógica en templates
- Uso de Pipes en lugar de métodos en templates
- HTTP interceptors y manejo de errores
- Guards e interfaces bien definidas

### Checklist de código limpio:
- Nombres descriptivos, funciones cortas y con una sola responsabilidad
- Sin código muerto, comentado o duplicado
- **Sin "console.log" ni código de depuración en producción (ver regla no negociable arriba)**
- Manejo de errores explícito y consistente
- Sin "magic numbers"/strings sin constantes

### Checklist de Seguridad (Ethical Hacking):
- XSS: innerHTML, bypassSecurityTrust*, [innerHTML]
- CSRF: tokens en formularios, HttpOnly cookies
- Inyección en URLs (router.navigate con input del usuario)
- Exposición de tokens/secrets en código
- Hardcoded credentials
- Validación insuficiente en formularios (solo client-side)
- CORS mal configurado en servicios
- Open redirects
- Sensitive data en LocalStorage/SessionStorage sin cifrado
- Template injection
- Prototype pollution

Responde ÚNICAMENTE con el JSON del esquema indicado arriba, sin texto adicional ni markdown fences.`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gemini-2.5-flash',
      max_tokens: 24000,
      // Gemini 2.5 Flash "piensa" (reasoning) por defecto y esos tokens de
      // thinking salen del mismo presupuesto que max_tokens — con diffs
      // grandes y el JSON de salida ya extenso (scope + cobertura), el
      // thinking se comía casi todo el presupuesto y la respuesta llegaba
      // cortada a mitad del JSON. Con "none" el JSON ya no se corta, pero el
      // modelo empezó a saltarse instrucciones secundarias (dejaba
      // "requirements_coverage" vacío) — "low" le da un margen chico de
      // razonamiento (~1024 tokens, bien lejos del límite de max_tokens) para
      // que siga todas las instrucciones sin volver a truncar la salida.
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    // Google AI Studio — endpoint compatible con OpenAI
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
            resolve(parsed.choices[0].message.content);
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

// ─── Formatear el comentario de GitHub ───────────────────────────────────────
function formatGitHubComment(review) {
  const severityEmoji = {
    CRITICAL: '🚨', HIGH: '🔴', MEDIUM: '🟠', LOW: '🟡',
    WARNING: '⚠️', INFO: 'ℹ️', GOOD: '✅', NONE: '✅'
  };

  const verdictEmoji = {
    APPROVE: '✅ APROBADO',
    REQUEST_CHANGES: '❌ REQUIERE CAMBIOS',
    COMMENT: '💬 COMENTARIOS'
  };

  const scoreBar = (score) => {
    const filled = Math.round(score);
    return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${score}/10`;
  };

  let comment = `# 🤖 Angular PR Review Agent\n\n`;
  comment += `> **Revisión automática generada por Gemini 2.5 Flash (Google AI Studio)**\n\n`;
  comment += `---\n\n`;

  // Header
  comment += `## ${verdictEmoji[review.verdict] || '💬 REVISIÓN'}\n\n`;
  comment += `**Puntuación:** \`${scoreBar(review.score)}\`\n\n`;
  comment += `### 📋 Resumen\n${review.summary}\n\n`;
  comment += `---\n\n`;

  // Alcance (scope) — se muestra siempre que el PR declaró requerimientos,
  // haya o no violaciones, para que quede explícito el resultado del chequeo.
  if (review.scope_declared) {
    if (review.scope_violations && review.scope_violations.length > 0) {
      comment += `## 🎯 Fuera de Alcance\n\n`;
      comment += `Se pegaron requerimientos en la descripción de este PR y los siguientes cambios no corresponden a ninguno de ellos:\n\n`;
      review.scope_violations.forEach(v => {
        comment += `- 🚫 **\`${v.file}\`** — ${v.summary}\n`;
        comment += `  > Motivo: ${v.reason}\n\n`;
      });
    } else {
      comment += `## 🎯 Alcance\n\n`;
      comment += `✅ Todos los cambios de este PR corresponden a los requerimientos declarados en la descripción.\n\n`;
    }
    comment += `---\n\n`;
  }

  // Cobertura de requerimientos — informativo, no bloquea el PR. Un PR puede
  // cubrir solo una parte de la lista a propósito (trabajo en varios PRs).
  if (review.requirements_coverage && review.requirements_coverage.length > 0) {
    const covered = review.requirements_coverage.filter(r => r.covered).length;
    const total = review.requirements_coverage.length;
    comment += `## 📋 Cobertura de Requerimientos\n\n`;
    comment += `${covered}/${total} requerimientos declarados se ven reflejados en este diff (informativo — no bloquea el PR, puede que el resto se desarrolle en otro commit o PR):\n\n`;
    review.requirements_coverage.forEach(r => {
      comment += `- ${r.covered ? '✅' : '⬜'} ${r.requirement}\n`;
      if (r.note) comment += `  > ${r.note}\n`;
    });
    comment += `\n---\n\n`;
  }

  // Security Alerts (primero por importancia)
  if (review.security_alerts && review.security_alerts.length > 0) {
    const hasCritical = review.security_alerts.some(a => a.severity === 'CRITICAL' || a.severity === 'HIGH');
    comment += `## ${hasCritical ? '🚨' : '🔒'} Alertas de Seguridad\n\n`;

    review.security_alerts.forEach(alert => {
      const emoji = severityEmoji[alert.severity] || '🔍';
      comment += `<details>\n<summary>${emoji} <strong>[${alert.severity}] ${alert.type}</strong> — ${alert.description.substring(0, 80)}...</summary>\n\n`;
      comment += `**Descripción:** ${alert.description}\n\n`;
      if (alert.location) comment += `**Ubicación:** \`${alert.location}\`\n\n`;
      comment += `**Mitigación:** ${alert.mitigation}\n\n`;
      if (alert.cwe_reference) comment += `**Referencia:** [${alert.cwe_reference}](https://cwe.mitre.org/data/definitions/${alert.cwe_reference.replace('CWE-', '')}.html)\n\n`;
      comment += `</details>\n\n`;
    });
    comment += `---\n\n`;
  }

  // Angular Best Practices
  if (review.angular_best_practices && review.angular_best_practices.length > 0) {
    comment += `## 🅰️ Angular Best Practices\n\n`;
    review.angular_best_practices.forEach(item => {
      const emoji = severityEmoji[item.severity] || '📌';
      comment += `${emoji} **[${item.severity}] ${item.category}**\n`;
      comment += `- **Problema:** ${item.issue}\n`;
      if (item.location) comment += `- **Ubicación:** \`${item.location}\`\n`;
      comment += `- **Recomendación:** ${item.recommendation}\n\n`;
    });
    comment += `---\n\n`;
  }

  // Code Quality
  if (review.code_quality && review.code_quality.length > 0) {
    comment += `## 🔬 Calidad del Código\n\n`;
    review.code_quality.forEach(item => {
      const emoji = severityEmoji[item.severity] || '📌';
      comment += `${emoji} **[${item.severity}] ${item.category}**\n`;
      comment += `- **Descripción:** ${item.issue}\n`;
      if (item.location) comment += `- **Ubicación:** \`${item.location}\`\n`;
      comment += `- **Recomendación:** ${item.recommendation}\n\n`;
    });
    comment += `---\n\n`;
  }

  // Performance
  if (review.performance_issues && review.performance_issues.length > 0) {
    comment += `## ⚡ Performance\n\n`;
    review.performance_issues.forEach(item => {
      const emoji = severityEmoji[item.severity] || '📌';
      comment += `${emoji} **[${item.severity}]** ${item.issue}\n`;
      comment += `  > 💡 ${item.recommendation}\n\n`;
    });
    comment += `---\n\n`;
  }

  // Accessibility
  if (review.accessibility && review.accessibility.length > 0) {
    comment += `## ♿ Accesibilidad\n\n`;
    review.accessibility.forEach(item => {
      const emoji = severityEmoji[item.severity] || '📌';
      comment += `${emoji} ${item.issue}\n  > ${item.recommendation}\n\n`;
    });
    comment += `---\n\n`;
  }

  // Positivos
  if (review.positive_highlights && review.positive_highlights.length > 0) {
    comment += `## 🌟 Aspectos Positivos\n\n`;
    review.positive_highlights.forEach(h => comment += `- ✅ ${h}\n`);
    comment += `\n---\n\n`;
  }

  // Cambios requeridos
  if (review.required_changes && review.required_changes.length > 0) {
    comment += `## ❗ Cambios Requeridos\n\n`;
    review.required_changes.forEach(c => comment += `- [ ] ${c}\n`);
    comment += `\n---\n\n`;
  }

  // Mejoras sugeridas
  if (review.suggested_improvements && review.suggested_improvements.length > 0) {
    comment += `## 💡 Mejoras Sugeridas\n\n`;
    review.suggested_improvements.forEach(s => comment += `- ${s}\n`);
    comment += `\n`;
  }

  comment += `\n---\n*🤖 Revisión generada automáticamente por Angular Review Agent (Gemini 2.5 Flash · Google AI Studio) • [Ver configuración](.github/workflows/angular-pr-review.yml)*`;

  return comment;
}

// ─── Publicar comentario en GitHub ───────────────────────────────────────────
async function postGitHubComment(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ body });
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/comments`,
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Angular-Review-Agent',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => resolve(JSON.parse(responseData)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Crear PR Review (aprobación/cambios) ────────────────────────────────────
async function submitPRReview(verdict, body) {
  const eventMap = {
    APPROVE: 'APPROVE',
    REQUEST_CHANGES: 'REQUEST_CHANGES',
    COMMENT: 'COMMENT'
  };

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      body: body.substring(0, 500) + '\n\n*Ver comentario completo abajo* ↓',
      event: eventMap[verdict] || 'COMMENT'
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}/reviews`,
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Angular-Review-Agent',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => resolve(JSON.parse(responseData)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 Iniciando Angular PR Review Agent (Gemini)...');
  console.log(`📋 PR #${PR_NUMBER}: ${PR_TITLE}`);
  console.log(`👤 Autor: ${PR_AUTHOR}`);

  const diff = getDiff();
  console.log(`📄 Diff obtenido: ${diff.length} caracteres`);

  const scopeRequirements = extractScopeRequirements(PR_BODY);
  if (scopeRequirements) {
    console.log(`🎯 Requerimientos de alcance detectados en la descripción del PR (${scopeRequirements.length} caracteres)`);
  } else {
    console.log('🎯 Sin bloque SCOPE en la descripción del PR: no se valida alcance.');
  }

  console.log('🤖 Consultando Gemini 2.5 Flash (Google AI Studio)...');
  const rawReview = await callGemini(diff, scopeRequirements);

  // Parsear JSON
  let review;
  try {
    const cleanJson = rawReview.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    review = JSON.parse(cleanJson);
    review.angular_best_practices = review.angular_best_practices || [];
    review.code_quality = review.code_quality || [];
    review.security_alerts = review.security_alerts || [];
    review.performance_issues = review.performance_issues || [];
    review.accessibility = review.accessibility || [];
    review.scope_violations = review.scope_violations || [];
    review.requirements_coverage = review.requirements_coverage || [];
    review.positive_highlights = review.positive_highlights || [];
    review.required_changes = review.required_changes || [];
    review.suggested_improvements = review.suggested_improvements || [];
    console.log('✅ Revisión parseada correctamente');
  } catch (e) {
    console.error('❌ Error al parsear JSON:', e.message);
    review = {
      summary: 'Error al procesar la revisión automática.',
      verdict: 'COMMENT',
      score: 0,
      angular_best_practices: [],
      code_quality: [],
      security_alerts: [],
      performance_issues: [],
      accessibility: [],
      scope_violations: [],
      requirements_coverage: [],
      positive_highlights: [],
      required_changes: [],
      suggested_improvements: [rawReview]
    };
  }
  review.scope_declared = !!scopeRequirements;

  // ── Gate determinístico: console.log prohibido ──
  const consoleLogFindings = scanForConsoleLog(diff);
  if (consoleLogFindings.length > 0) {
    console.log(`🚫 Se encontraron ${consoleLogFindings.length} uso(s) de console.log — forzando REQUEST_CHANGES`);
    review.verdict = 'REQUEST_CHANGES';
    consoleLogFindings.reverse().forEach((finding) => {
      const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
      review.code_quality.unshift({
        severity: 'CRITICAL',
        category: 'console.log prohibido',
        issue: `Se encontró un "console.log" en el código añadido: \`${finding.code}\``,
        location,
        recommendation: 'Elimina el console.log del código de producción. Usa un logger apropiado (servicio de logging inyectable) o elimínalo antes de mergear.',
      });
      review.required_changes.unshift(`Eliminar console.log en ${location}`);
    });
  }

  // ── Gate determinístico: cambios fuera de alcance ──
  if (review.scope_violations && review.scope_violations.length > 0) {
    console.log(`🎯 Se encontraron ${review.scope_violations.length} cambio(s) fuera de alcance — forzando REQUEST_CHANGES`);
    review.verdict = 'REQUEST_CHANGES';
    review.scope_violations.slice().reverse().forEach((v) => {
      review.required_changes.unshift(`Fuera de alcance en ${v.file}: ${v.summary}`);
    });
  }

  // Formatear y publicar
  const comment = formatGitHubComment(review);
  console.log('💬 Publicando revisión en GitHub...');

  await postGitHubComment(comment);
  await submitPRReview(review.verdict, review.summary);

  console.log(`\n✅ Revisión completada:`);
  console.log(`   Veredicto: ${review.verdict}`);
  console.log(`   Puntuación: ${review.score}/10`);

  const criticalSecurity = review.security_alerts?.filter(a =>
    a.severity === 'CRITICAL' || a.severity === 'HIGH'
  ) || [];

  const scopeViolationCount = review.scope_violations?.length || 0;

  if (criticalSecurity.length > 0 || consoleLogFindings.length > 0 || scopeViolationCount > 0) {
    console.log(`\n🚨 ALERTA: ${criticalSecurity.length} vulnerabilidad(es) crítica(s), ${consoleLogFindings.length} console.log y ${scopeViolationCount} cambio(s) fuera de alcance detectado(s)!`);
    process.exit(1); // Falla el check si hay vulnerabilidades críticas, console.log o scope creep
  }
}

main().catch(err => {
  console.error('💥 Error en Angular Review Agent:', err);
  process.exit(1);
});
