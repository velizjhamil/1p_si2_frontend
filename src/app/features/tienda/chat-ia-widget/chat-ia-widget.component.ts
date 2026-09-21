import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CarritoService } from '../../../core/services/carrito.service';
import { IaService } from '../../../core/services/ia.service';
import { ChatMessage, ProductoResumenIA } from '../../../core/models/ia.model';

@Component({
  selector: 'app-chat-ia-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-ia-widget.component.html',
})
export class ChatIaWidgetComponent implements OnInit, OnDestroy {
  private readonly iaService = inject(IaService);
  protected readonly carritoService = inject(CarritoService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  /** Controla si la ventana flotante de chat está expandida o minimizada */
  readonly abierto = signal(false);

  /** Historial conversacional de la sesión actual */
  readonly mensajes = signal<ChatMessage[]>([]);

  /** Indicador reactivo de generación y consulta RAG en progreso */
  readonly escribiendo = signal(false);

  /** Texto actual del campo de entrada */
  inputTexto = '';

  /** Preguntas frecuentes y sugerencias contextuales de moda */
  readonly sugerencias = signal<string[]>([
    '¿Qué vestidos elegantes tienen disponibles?',
    '¿Dónde quedan sus sucursales físicas?',
    '¿Tienen cupones de descuento vigentes?',
    '¿Qué prendas hay de nueva temporada?',
  ]);

  /** ID del producto recién agregado para feedback visual */
  readonly productoAgregadoId = signal<number | null>(null);

  /** Nombre del usuario autenticado */
  readonly nombreUsuario = computed(() => {
    return this.auth.getCurrentUser()?.nombre ?? 'Cliente';
  });

  ngOnInit(): void {
    this.iniciarConversacion();
  }

  ngOnDestroy(): void {}

  /** Inicializa el mensaje de bienvenida de la asesora de moda */
  private iniciarConversacion(): void {
    if (this.mensajes().length === 0) {
      const nombre = this.nombreUsuario();
      this.mensajes.set([
        {
          id: 'msg-welcome',
          rol: 'asistente',
          contenido: `¡Hola **${nombre}**! ✨ Soy **Attention AI**, tu asesora de moda y estilismo personal.\n\nHe conectado con nuestro catálogo e inventario en tiempo real para recomendarte prendas exclusivas, consultar stock en sucursales o informarte sobre nuestras promociones. ¿En qué puedo ayudarte hoy?`,
          fecha: new Date().toISOString(),
          sugerencias: this.sugerencias(),
        },
      ]);
    }
  }

  /** Alterna la visibilidad de la ventana de chat */
  toggleChat(): void {
    const nuevoEstado = !this.abierto();
    this.abierto.set(nuevoEstado);
    if (nuevoEstado) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  /** Envía la consulta a la IA (Enter o clic en botón) */
  enviarMensaje(textoPersonalizado?: string): void {
    const texto = (textoPersonalizado ?? this.inputTexto).trim();
    if (!texto || this.escribiendo()) return;

    // Agregar mensaje del usuario a la lista
    const msgUsuario: ChatMessage = {
      id: `usr-${Date.now()}`,
      rol: 'usuario',
      contenido: texto,
      fecha: new Date().toISOString(),
    };

    this.mensajes.update((prev) => [...prev, msgUsuario]);
    this.inputTexto = '';
    this.escribiendo.set(true);
    setTimeout(() => this.scrollToBottom(), 50);

    // Consultar el endpoint RAG del backend
    this.iaService.enviarMensaje(texto, this.mensajes()).subscribe({
      next: (resp) => {
        const data = resp.data;
        const msgAsistente: ChatMessage = {
          id: `ia-${Date.now()}`,
          rol: 'asistente',
          contenido: data.respuesta,
          productos_recomendados: data.productos_recomendados,
          productos_detalle: data.productos_detalle,
          sugerencias: data.sugerencias,
          fecha: new Date().toISOString(),
        };

        this.mensajes.update((prev) => [...prev, msgAsistente]);
        if (data.sugerencias && data.sugerencias.length > 0) {
          this.sugerencias.set(data.sugerencias);
        }
        this.escribiendo.set(false);
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        const msgError: ChatMessage = {
          id: `err-${Date.now()}`,
          rol: 'asistente',
          contenido:
            err?.error?.detail ??
            'Lo siento, tuve un inconveniente al consultar nuestro catálogo. Por favor intenta de nuevo en unos momentos.',
          fecha: new Date().toISOString(),
          esError: true,
        };
        this.mensajes.update((prev) => [...prev, msgError]);
        this.escribiendo.set(false);
        setTimeout(() => this.scrollToBottom(), 100);
      },
    });
  }

  /** Selecciona una sugerencia rápida para enviar automáticamente */
  seleccionarSugerencia(sug: string): void {
    this.enviarMensaje(sug);
  }

  /** Añade un producto recomendado directamente al carrito de compras (CU15) */
  agregarAlCarrito(prod: ProductoResumenIA): void {
    const tallaDefecto = prod.tallas && prod.tallas.length > 0 ? prod.tallas[0] : 'M';
    const colorDefecto = prod.colores && prod.colores.length > 0 ? prod.colores[0].nombre_color : 'Único';
    const hexDefecto = prod.colores && prod.colores.length > 0 ? prod.colores[0].codigo_hex || '#000000' : '#000000';

    this.carritoService.agregarAlCarrito({
      producto_id: prod.id_producto,
      nombre: prod.nombre,
      talla: tallaDefecto,
      color: colorDefecto,
      color_hex: hexDefecto,
      precio: prod.precio_venta,
      cantidad: 1,
      imagen_url: prod.imagen_url ?? null,
    });

    // Feedback visual temporal
    this.productoAgregadoId.set(prod.id_producto);
    setTimeout(() => {
      if (this.productoAgregadoId() === prod.id_producto) {
        this.productoAgregadoId.set(null);
      }
    }, 2500);
  }

  /** Redirige al Probador Virtual AR con la prenda recomendada */
  probarConIA(prod: ProductoResumenIA): void {
    this.abierto.set(false);
    this.router.navigate(['/probador-virtual'], {
      queryParams: { prenda_id: prod.id_producto },
    });
  }

  /** Limpia la conversación y reinicia el saludo */
  limpiarConversacion(): void {
    this.mensajes.set([]);
    this.iniciarConversacion();
  }

  /** Parser ligero de Markdown para negrita y saltos de línea */
  formatearMarkdown(texto: string): string {
    if (!texto) return '';
    // Escapar etiquetas HTML
    let escaped = texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Negritas: **texto**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Cursivas: *texto*
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Viñetas: - texto
    escaped = escaped.replace(/(?:^|\n)- (.*?)(?=\n|$)/g, '<br>• $1');

    // Saltos de línea
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      try {
        const el = this.scrollContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      } catch (_) {}
    }
  }
}
