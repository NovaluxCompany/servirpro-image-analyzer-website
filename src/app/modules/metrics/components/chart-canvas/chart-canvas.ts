import { Component, ElementRef, OnDestroy, afterRenderEffect, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
Chart.defaults.color = '#52514e';

/**
 * Envoltorio mínimo de Chart.js: recrea el gráfico cada vez que cambia la
 * configuración y lo destruye al salir. La altura la da el contenedor
 * (incluye la banda del eje X, para no generar scroll interno).
 */
@Component({
  selector: 'app-chart-canvas',
  standalone: true,
  template: `
    <div class="relative w-full" [style.height]="height()">
      <canvas #canvas [attr.aria-label]="ariaLabel()" role="img"></canvas>
    </div>
  `,
})
export class ChartCanvasComponent implements OnDestroy {
  config = input.required<ChartConfiguration>();
  height = input('280px');
  ariaLabel = input('Gráfico');

  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;

  constructor() {
    // Después del render: el <canvas> ya existe en el DOM cuando se crea el gráfico.
    afterRenderEffect(() => {
      const config = this.config();
      const canvas = this.canvas().nativeElement;
      this.chart?.destroy();
      this.chart = new Chart(canvas, config);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}
