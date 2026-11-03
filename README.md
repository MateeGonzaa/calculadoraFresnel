# FresnelMG — Calculadora de Zona de Fresnel

Aplicación web para calcular la primera zona de Fresnel y visualizar un enlace inalámbrico.

## Estructura

- `index.html`: calculadora + simulador.
- `historial.html`: historial independiente de cálculos.
- `informacion.html`: conceptos, fórmula y explicación del truncamiento.
- `style/styles.css`: estilos compartidos.
- `js/script.js`: lógica de cálculo, validaciones, LocalStorage y simulador.

## Fórmula

`F₁ [m] = 8.656 × √(D [km] / f [GHz])`

El resultado se **trunca a dos decimales**, no se redondea.

## Navegación

La barra superior permite acceder a:

1. Calculadora
2. Historial
3. Información

Los cálculos realizados desde `index.html` quedan disponibles en `historial.html` mediante `localStorage`.


## Validaciones

- Acepta coma **o** punto decimal; mientras se escribe se descartan letras y símbolos.
- Rechaza campos vacíos, ceros y negativos, con mensaje por campo.
- Truncado seguro frente a errores de coma flotante (0.29 → 0.29, no 0.28).

## Simulador

- La zona de Fresnel va de TX a RX con forma de lente; la línea verde punteada marca el 60 %.
- Radio local: `F(p) = F₁ · 2 · √(p · (1 − p))`.
- Estados: ≥ 60 % libre = recomendado · 40–60 % = advertencia · < 40 % o línea cortada = obstruido. El piso (0 m) siempre figura como obstruido.

