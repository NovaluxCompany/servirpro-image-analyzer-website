import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

// Envoltorio reutilizable para tablas: agrega una barra de scroll horizontal
// arriba (sincronizada con la real, para no tener que bajar hasta el final
// de la tabla para verla) y deja el thead pegado (sticky) mientras se
// desplaza verticalmente dentro del contenedor.
@Component({
  selector: 'app-table-scroll',
  standalone: true,
  templateUrl: './table-scroll.html',
})
export class TableScrollComponent implements AfterViewInit, OnDestroy {
  @ViewChild('topScroll') private topScrollRef!: ElementRef<HTMLDivElement>;
  @ViewChild('topScrollInner') private topScrollInnerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('mainScroll') private mainScrollRef!: ElementRef<HTMLDivElement>;

  private resizeObserver?: ResizeObserver;
  private syncingFromTop = false;
  private syncingFromMain = false;

  ngAfterViewInit(): void {
    const table = this.mainScrollRef.nativeElement.querySelector('table');
    if (!table) return;

    const syncWidth = () => {
      this.topScrollInnerRef.nativeElement.style.width = `${table.scrollWidth}px`;
    };
    syncWidth();

    this.resizeObserver = new ResizeObserver(syncWidth);
    this.resizeObserver.observe(table);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  onTopScroll(): void {
    if (this.syncingFromMain) return;
    this.syncingFromTop = true;
    this.mainScrollRef.nativeElement.scrollLeft = this.topScrollRef.nativeElement.scrollLeft;
    this.syncingFromTop = false;
  }

  onMainScroll(): void {
    if (this.syncingFromTop) return;
    this.syncingFromMain = true;
    this.topScrollRef.nativeElement.scrollLeft = this.mainScrollRef.nativeElement.scrollLeft;
    this.syncingFromMain = false;
  }
}
