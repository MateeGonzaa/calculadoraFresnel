# FresnelMG — Calculadora de Zona de Fresnel

Aplicación web para calcular la primera zona de Fresnel y visualizar un enlace inalámbrico.

## Estructura

- `index.html`: calculadora + simulador.
- `historial.html`: historial independiente de cálculos.
- `informacion.html`: conceptos, fórmula y explicación del truncamiento.
- `styles.css`: estilos compartidos.
- `script.js`: lógica de cálculo, validaciones, LocalStorage y simulador.

## Fórmula

`F₁ [m] = 8.656 × √(D [km] / f [GHz])`

El resultado se **trunca a dos decimales**, no se redondea.

## Navegación

La barra superior permite acceder a:

1. Calculadora
2. Historial
3. Información

Los cálculos realizados desde `index.html` quedan disponibles en `historial.html` mediante `localStorage`.

