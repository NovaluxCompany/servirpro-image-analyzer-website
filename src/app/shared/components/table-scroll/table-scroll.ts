import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

/**
 * Alto real del header de la app (layout.html, `<header>` con
 * `sticky top-0`). El encabezado "congelado" de la tabla se posiciona justo
 * debajo, para no quedar tapado por él.
 */
const APP_HEADER_HEIGHT = 73;

// Envoltorio reutilizable para tablas: agrega una barra de scroll horizontal
// arriba (sincronizada con la real, para no tener que bajar hasta el final
// de la tabla para verla) y un encabezado "congelado" que se pega debajo del
// header de la app mientras se hace scroll por la página.
//
// El encabezado congelado NO usa `position: sticky` en el thead real: eso
// requeriría que este componente no tuviera scroll horizontal (`overflow-x:
// auto`), porque cualquier contenedor con overflow horizontal obliga al
// navegador a activar también overflow vertical, y eso rompe el sticky
// relativo a la página (comprobado). En su lugar, se clona el thead en un
// elemento aparte con `position: fixed`, que se muestra/oculta y se
// sincroniza en scroll horizontal por JS — la misma técnica que usan
// librerías de tablas con "frozen header" (ag-Grid, DataTables, etc.).
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

  private thead?: HTMLTableSectionElement;
  private frozenWrapper?: HTMLDivElement;
  private frozenTable?: HTMLTableElement;
  private frozenThead?: HTMLTableSectionElement;
  private isFrozenVisible = false;

  private readonly onWindowScroll = (): void => this.updateFrozenVisibility();
  private readonly onWindowResize = (): void => this.syncFrozenHeaderLayout();

  /** Header de la app (73px) + alto real de la barra de scroll horizontal
   *  "espejo" (también sticky, queda pegada justo debajo del header). */
  private get frozenHeaderTop(): number {
    return APP_HEADER_HEIGHT + (this.topScrollRef?.nativeElement.offsetHeight ?? 0);
  }

  ngAfterViewInit(): void {
    const table = this.mainScrollRef.nativeElement.querySelector('table');
    if (!table) return;

    const syncWidth = () => {
      this.topScrollInnerRef.nativeElement.style.width = `${table.scrollWidth}px`;
      this.syncFrozenHeaderLayout();
    };
    syncWidth();

    this.resizeObserver = new ResizeObserver(syncWidth);
    this.resizeObserver.observe(table);

    this.thead = table.querySelector('thead') ?? undefined;
    if (this.thead) {
      this.buildFrozenHeader();
      window.addEventListener('scroll', this.onWindowScroll, { passive: true });
      window.addEventListener('resize', this.onWindowResize);
      this.updateFrozenVisibility();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    window.removeEventListener('scroll', this.onWindowScroll);
    window.removeEventListener('resize', this.onWindowResize);
    this.frozenWrapper?.remove();
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
    this.syncFrozenHeaderScrollX();
  }

  /** Crea el clon del thead, oculto por defecto, movido a document.body para
   *  que `position: fixed` funcione siempre relativo al viewport real. */
  private buildFrozenHeader(): void {
    if (!this.thead) return;

    this.frozenWrapper = document.createElement('div');
    this.frozenWrapper.style.position = 'fixed';
    this.frozenWrapper.style.top = `${this.frozenHeaderTop}px`;
    this.frozenWrapper.style.overflow = 'hidden';
    this.frozenWrapper.style.zIndex = '20';
    this.frozenWrapper.style.display = 'none';
    this.frozenWrapper.style.pointerEvents = 'none';

    this.frozenTable = document.createElement('table');
    this.frozenTable.className = this.mainScrollRef.nativeElement.querySelector('table')?.className ?? '';
    this.frozenTable.style.margin = '0';

    this.frozenThead = this.thead.cloneNode(true) as HTMLTableSectionElement;
    this.frozenTable.appendChild(this.frozenThead);
    this.frozenWrapper.appendChild(this.frozenTable);
    document.body.appendChild(this.frozenWrapper);

    this.syncFrozenHeaderLayout();
  }

  /** Iguala ancho de tabla/columnas del clon con las reales, celda por celda. */
  private syncFrozenHeaderLayout(): void {
    if (!this.thead || !this.frozenTable || !this.frozenThead || !this.frozenWrapper) return;

    const table = this.mainScrollRef.nativeElement.querySelector('table');
    if (!table) return;

    this.frozenWrapper.style.top = `${this.frozenHeaderTop}px`;
    this.frozenTable.style.width = `${table.scrollWidth}px`;

    const realCells = Array.from(this.thead.querySelectorAll('th'));
    const cloneCells = Array.from(this.frozenThead.querySelectorAll('th'));
    realCells.forEach((cell, i) => {
      const width = (cell as HTMLElement).getBoundingClientRect().width;
      const cloneCell = cloneCells[i] as HTMLElement | undefined;
      if (cloneCell) {
        cloneCell.style.width = `${width}px`;
        cloneCell.style.minWidth = `${width}px`;
        cloneCell.style.maxWidth = `${width}px`;
        cloneCell.style.boxSizing = 'border-box';
      }
    });

    this.syncFrozenHeaderPositionX();
    this.syncFrozenHeaderScrollX();
  }

  /** Alinea el wrapper fijo horizontalmente con el div de scroll real (misma
   *  posición/ancho en pantalla), para que el recorte y las columnas calcen. */
  private syncFrozenHeaderPositionX(): void {
    if (!this.frozenWrapper) return;
    const rect = this.mainScrollRef.nativeElement.getBoundingClientRect();
    this.frozenWrapper.style.left = `${rect.left}px`;
    this.frozenWrapper.style.width = `${rect.width}px`;
  }

  /** Aplica el mismo desplazamiento horizontal que tiene la tabla real. */
  private syncFrozenHeaderScrollX(): void {
    if (!this.frozenTable) return;
    this.frozenTable.style.transform = `translateX(-${this.mainScrollRef.nativeElement.scrollLeft}px)`;
  }

  /** Muestra el clon solo cuando el thead real ya se scrolleó por encima del
   *  header de la app; si no, el thead real sigue visible en flujo normal. */
  private updateFrozenVisibility(): void {
    if (!this.thead || !this.frozenWrapper) return;

    const shouldShow = this.thead.getBoundingClientRect().top < this.frozenHeaderTop;
    if (shouldShow !== this.isFrozenVisible) {
      this.isFrozenVisible = shouldShow;
      this.frozenWrapper.style.display = shouldShow ? 'block' : 'none';
    }
    // Reposiciona en cada scroll (no solo al aparecer) por si el sidebar se
    // colapsó/expandió mientras el encabezado ya estaba congelado.
    if (shouldShow) {
      this.syncFrozenHeaderPositionX();
      this.syncFrozenHeaderScrollX();
    }
  }
}
