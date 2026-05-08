/**
 * 🅰️ Angular PR Review Agent
 * Analiza PRs con foco en Angular best practices, calidad de código y seguridad
 * Powered by Google AI Studio (Gemini 2.5 Flash) — Free tier, sin tarjeta de crédito
 */

const fs = require('fs');
const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;
const PR_TITLE = process.env.PR_TITLE;
const PR_AUTHOR = process.env.PR_AUTHOR;
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

// ─── Llamar a Google AI Studio (Gemini 2.5 Flash) ────────────────────────────
async function callGemini(diff) {
  const systemPrompt = `Eres un experto en Angular (v17+), TypeScript y seguridad web.
Tu tarea es revisar Pull Requests y proporcionar feedback estructurado, accionable y preciso.
Siempre respondes en español. Tu tono es profesional pero amigable.`;

  const userPrompt = `## Pull Request a revisar
**Título:** ${PR_TITLE}
**Autor:** ${PR_AUTHOR}
**PR #:** ${PR_NUMBER}

## Diff del código
\`\`\`diff
${diff}
\`\`\`

## Instrucciones de revisión

Analiza este PR de Angular y proporciona una revisión COMPLETA en el siguiente formato JSON exacto:

{
  "summary": "Resumen ejecutivo del PR en 2-3 oraciones",
  "verdict": "APPROVE | REQUEST_CHANGES | COMMENT",
  "score": <número del 1 al 10>,
  "angular_best_practices": [
    {
      "severity": "CRITICAL | WARNING | INFO | GOOD",
      "category": "Categoría Angular",
      "issue": "Descripción del problema o buena práctica",
      "location": "archivo o línea si aplica",
      "recommendation": "Cómo mejorar o qué está bien"
    }
  ],
  "code_quality": [
    {
      "severity": "CRITICAL | WARNING | INFO | GOOD",
      "category": "Categoría de calidad",
      "issue": "Descripción",
      "location": "archivo o línea si aplica",
      "recommendation": "Mejora sugerida"
    }
  ],
  "security_alerts": [
    {
      "severity": "CRITICAL | HIGH | MEDIUM | LOW | NONE",
      "type": "Tipo de vulnerabilidad (XSS, CSRF, Injection, etc.)",
      "description": "Descripción detallada del riesgo",
      "location": "archivo o línea",
      "mitigation": "Cómo mitigarlo",
      "cwe_reference": "CWE-XXX si aplica"
    }
  ],
  "performance_issues": [
    {
      "severity": "HIGH | MEDIUM | LOW",
      "issue": "Problema de performance",
      "recommendation": "Optimización sugerida"
    }
  ],
  "accessibility": [
    {
      "severity": "HIGH | MEDIUM | LOW",
      "issue": "Problema de accesibilidad WCAG",
      "recommendation": "Corrección sugerida"
    }
  ],
  "positive_highlights": ["Aspecto positivo 1", "Aspecto positivo 2"],
  "required_changes": ["Cambio obligatorio 1 (solo si verdict es REQUEST_CHANGES)"],
  "suggested_improvements": ["Mejora sugerida 1", "Mejora sugerida 2"]
}

### Checklist Angular que DEBES revisar:
- OnPush Change Detection Strategy
- TrackBy en ngFor
- Uso correcto de async pipe vs subscripciones manuales
- Unsubscribe / takeUntilDestroyed
- Lazy loading de módulos/rutas
- Standalone components (Angular 17+)
- Signals API si aplica
- Inyección de dependencias correcta (inject() function)
- Tipado estricto TypeScript
- Nomenclatura Angular (kebab-case, PascalCase)
- Separación de responsabilidades (Smart/Dumb components)
- Evitar lógica en templates
- Uso de Pipes en lugar de métodos en templates
- HTTP interceptors y manejo de errores
- Guard e interfaces bien definidas

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown fences.`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gemini-2.5-flash',         // Modelo gratuito de Google AI Studio
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    // Google AI Studio — endpoint compatible con OpenAI
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/openai/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Respuesta en formato OpenAI: choices[0].message.content
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

  let comment = `# 🅰️ Angular PR Review Agent\n\n`;
  comment += `> **Revisión automática generada por Gemini 2.5 Flash (Google AI Studio)**\n\n`;
  comment += `---\n\n`;

  // Header
  comment += `## ${verdictEmoji[review.verdict] || '💬 REVISIÓN'}\n\n`;
  comment += `**Puntuación:** \`${scoreBar(review.score)}\`\n\n`;
  comment += `### 📋 Resumen\n${review.summary}\n\n`;
  comment += `---\n\n`;

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

  comment += `\n---\n*🤖 Revisión generada automáticamente por Angular Review Agent (Gemini 2.5 Flash • Google AI Studio) • [Ver configuración](.github/workflows/angular-pr-review.yml)*`;

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
  console.log('🅰️ Iniciando Angular PR Review Agent...');
  console.log(`📋 PR #${PR_NUMBER}: ${PR_TITLE}`);
  console.log(`👤 Autor: ${PR_AUTHOR}`);

  const diff = getDiff();
  console.log(`📄 Diff obtenido: ${diff.length} caracteres`);

  console.log('🤖 Consultando Gemini 2.5 Flash (Google AI Studio)...');
  const rawReview = await callGemini(diff);

  // Parsear JSON
  let review;
  try {
    const cleanJson = rawReview.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    review = JSON.parse(cleanJson);
    fs.writeFileSync('review_output.json', JSON.stringify(review, null, 2));
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
      positive_highlights: [],
      required_changes: [],
      suggested_improvements: [rawReview]
    };
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

  if (criticalSecurity.length > 0) {
    console.log(`\n🚨 ALERTA: ${criticalSecurity.length} vulnerabilidad(es) crítica(s) detectada(s)!`);
    process.exit(1); // Falla el check si hay vulnerabilidades críticas
  }
}

main().catch(err => {
  console.error('💥 Error en Angular Review Agent:', err);
  process.exit(1);
});
