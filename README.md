# Albion Market

Aplicación estática en español: HTML5, CSS3 y JavaScript puro. No necesita instalación de dependencias, claves de API, base de datos ni compilación.

## Ejecutar

- **Live Server:** abre esta carpeta en VS Code, haz clic derecho en `index.html` y selecciona «Open with Live Server».
- **Laragon:** copia la carpeta al directorio `www`, inicia el servidor y visita la dirección local asignada al proyecto.
- **Node.js:** desde esta carpeta, ejecuta `node server.cjs` y abre http://127.0.0.1:8081. Detén el servidor con Ctrl+C. Puedes cambiar el puerto mediante la variable de entorno `PORT`.

El catálogo viene incluido. Las consultas de precios e imágenes requieren conexión a Internet. Usa HTTP local para una ejecución consistente; no hace falta un backend de aplicación.

## Funcionalidad

- Autocompletado en español e inglés, insensible a acentos. Acepta «Bolsa del Adepto» como alias del nombre localizado «Bolsa del iniciado».
- 9,302 variantes T4–T8 incluidas, con IDs reales. Los encantamientos inexistentes se deshabilitan. Los recursos encantados usan sus IDs especiales, por ejemplo `T4_ORE_LEVEL4@4`.
- Calidades: Normal=1, Bueno=2, Sobresaliente=3, Excelente=4, Obra maestra=5. Los recursos y consumibles usan calidad 1.
- Servidores: Americas=`west`, Europe=`europe`, Asia=`east`.
- Siete ciudades, mejores precios, antigüedad y fechas exactas desplegables.
- Ceros, números inválidos y mercados ausentes se muestran como «Sin datos» y no intervienen en los mejores precios.
- Fechas de la API interpretadas en UTC, presentación en la zona horaria del navegador. Reciente: menos de 1 hora; moderado: 1–24 horas; antiguo: 24 horas o más. Las fechas ausentes o inconsistentes se señalan expresamente.
- Cambiar servidor, objeto o filtros consulta automáticamente. Un botón permite actualizar manualmente.
- Caché de respuestas de 60 segundos, cancelación de consultas anteriores, timeout de 18 segundos y espera ante HTTP 429.
- Cantidades, impuestos, Premium y método de venta configurables. Preferencias de cálculo guardadas localmente en el navegador.

## Cálculos

Compra = menor `sell_price_min` positivo. Venta inmediata = mayor `buy_price_max` positivo.

- Inversión = precio de compra × cantidad.
- Ingreso bruto = precio de venta × cantidad.
- Ganancia bruta = ingreso bruto − inversión.
- ROI bruto = ganancia bruta / inversión × 100.
- Comisiones = ingreso bruto × (impuesto + setup aplicable) / 100.
- Ganancia neta = ganancia bruta − comisiones.
- ROI neto = ganancia neta / inversión × 100.

La venta inmediata a una orden de compra existente no usa setup fee. El modo opcional «Crear orden» usa la mayor venta mínima observada como **precio objetivo estimado**, con setup fee; no representa una orden de compra ni garantiza ejecución. Las tarjetas superiores siguen mostrando venta inmediata.

Tasas iniciales editables: 8% sin Premium, 4% con Premium y 2.5% de setup. Verifica en el juego las tasas aplicables. No se modelan transporte, volumen disponible, redondeo de comisiones del juego ni renovaciones de órdenes. Los resultados pueden incluir decimales. Incluso los mejores precios pueden ser antiguos: la antigüedad siempre se conserva y se advierte en el cálculo.

## Archivos

- `index.html`: interfaz y ayuda.
- `styles.css`: diseño responsive, sin fuentes externas.
- `app.js`: búsqueda, peticiones, estados y eventos.
- `market.js`: funciones puras para datos, fechas y cálculos.
- `assets/items.js`: catálogo local de nombres e IDs.
- `assets/mark.svg`: marca vectorial propia.
- `server.cjs`: servidor local opcional, solo Node estándar.
- `market.test.cjs`: pruebas ejecutables con `node market.test.cjs`.
- `build-catalog.cjs`: transforma el catálogo original en el archivo reducido de la aplicación.

## Actualizar catálogo

Descarga https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json como `items-source.json` en esta carpeta. Ejecuta `node build-catalog.cjs`. El archivo original se usa solo para generar el catálogo, no es necesario para ejecutar la web.

## Fuentes

- Documentación API: https://west.albion-online-data.com/api-docs
- Americas: https://west.albion-online-data.com
- Europe: https://europe.albion-online-data.com
- Asia: https://east.albion-online-data.com
- Catálogo: https://github.com/ao-data/ao-bin-dumps (consulta del 25 de octubre de 2026).
- Imágenes de objetos: https://render.albiononline.com/v1/item/

Proyecto de fans, sin afiliación con Sandbox Interactive. Los datos de mercado dependen de las observaciones aportadas por jugadores al Albion Online Data Project.

## Herramientas de economía

El menú «Mesa del mercader» incluye ocho secciones. Todas están disponibles sin registro ni pago; «Premium del juego» únicamente cambia el impuesto usado en los cálculos.

1. **Comparador de precios:** la comparación original entre siete ciudades.
2. **Calculadora de refinamiento:** mineral, madera, fibra, piel y piedra; recetas y materiales reales, retorno con/sin foco, coste de estación por acción, impuestos y precio objetivo o venta inmediata.
3. **Refinamiento inteligente:** compara las variantes T4–T8 y encantamientos del recurso; reparte el presupuesto entre variantes con margen positivo.
4. **Crafteo:** recetas de equipo, materiales y artefactos. Los artefactos y componentes no retornables no reciben descuento por retorno. Incluye precios manuales opcionales para materiales y salida.
5. **Crafteo inteligente:** compara y distribuye el presupuesto entre tiers y encantamientos de una familia de equipo.
6. **Profit de transporte:** analiza la familia seleccionada o una selección de 12 familias de equipo; compara ciudades diferentes, ordena por neto o ROI y filtra por antigüedad. Aplica impuestos, coste de transporte por ruta, capital y capacidad de carga.
7. **Mercado Negro:** compara compras en ciudades con `buy_price_max` de la ubicación `Black Market` (3003). No presupone venta garantizada ni volumen conocido.
8. **Ahorra plata encantando:** compara compra directa frente a base + runas/almas/reliquias para cada paso .0–.3. Las cantidades provienen de la receta de cada pieza; no se ofrece .4 como mejora con estas piedras.

Las recetas y los metadatos se distribuyen localmente en `assets/recipes.js`: 7,177 recetas y 9,112 variantes con metadatos. No se necesita descargar recetas al ejecutar la app. El cliente `tools-api.js` agrupa hasta 35 objetos por petición, mantiene URLs acotadas, cachea 60 segundos, cancela consultas y respeta errores 429.

### Producción y presupuesto

El retorno, coste de estación y coste de foco relativo al base son valores **editables que debes verificar en el juego**. La aplicación no adivina tu bonificación de ciudad, estación ni especialización. La calidad del producto final tampoco está garantizada al fabricar.

- Capital inicial = todos los materiales de la receta + plata de la receta + estación.
- Valor de retorno esperado = materiales retornables × retorno introducido, valorados al precio de adquisición.
- Ganancia neta estimada = ingreso tras impuestos − capital inicial + valor del retorno esperado.
- El retorno representa materiales, no plata recibida. No se supone venta ni reinversión automática de lo recuperado. Las fracciones son expectativas; los resultados reales del juego son discretos.
- El plan inteligente ordena por ganancia / capital inicial y asigna acciones enteras bajo límites de presupuesto, porcentaje máximo por variante, máximo de acciones y foco disponible. Es una heurística, no una garantía de óptimo global. Redondea el foco por acción de forma conservadora.
- Los límites por variante ayudan a diversificar; no pueden asegurar que no satures el mercado, ya que la API de precios utilizada no informa del volumen.
- En transporte, cada fila es una alternativa independiente. El capital y coste de transporte no se comparten entre filas. La capacidad usa el peso base y no modela modificadores de carga.

### Pruebas y actualización de recetas

Ejecuta `node market.test.cjs` y `node economy.test.cjs` para comprobar cálculos, fechas, artefactos, foco, presupuestos, transporte, encantamientos y recetas.

Para actualizar recetas, descarga https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json como `recipes-source.json` y ejecuta `node build-recipes.cjs`. Actualiza primero `assets/items.js` si también cambió el catálogo. El original de recetas no se necesita al ejecutar la app.
