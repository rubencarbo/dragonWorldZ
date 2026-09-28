# DragonWorldZ 🐉

Prototipo de juego para smartphone inspirado en Dragon Ball (**fan game sin ánimo de lucro**).
Hecho con **Vue 3 + Three.js + Firebase**, sin paso de compilación.

Dos formas de jugar:

- **📖 Modo Historia**: un libro de cómic interactivo que recorre la saga desde el principio,
  vivido en primera persona por el protagonista de cada capítulo.
- **🌍 Mundo abierto**: una **bola 3D** que giras con el dedo. En cada lugar el personaje camina por
  un escenario de vóxeles, habla con NPCs y supera **misiones** cuyos combates son **juegos infantiles**.

En **castellano y català** (terminología del doblaje de TV3: Follet Tortuga, Cor Petit, Xixi, Iamxa...,
pero siempre **Kamehameha**).

## Estructura (10 archivos)

| Archivo | Contenido |
|---|---|
| `index.html` | Página, importmap con las librerías (Vue y Three.js desde CDN) |
| `estilos.css` | Estética retro 8 bits: base, componentes, pantallas y minijuegos |
| `app.js` | Arranque: Firebase, guardado, estado de la partida, misiones, navegación, bocadillos de cómic y combates |
| `pantallas.js` | Globo 3D, lugar (tocar para caminar), libro del Modo Historia, ajustes y panel Admin |
| `motor.js` | Renderer retro, vóxeles, modelos 3D, planeta procedural, música (FM estilo AdLib y chiptune), recorte de sprites, lógica de misiones y pathfinding |
| `personajes.js` | Sprites de los protagonistas y sus transformaciones (`SPRITES`, `FORMS`) y generador de personajes secundarios (`CHARACTER_SPECS`) |
| `mundos.js` | Mundos, mapas de cada lugar, misiones base y pistas de música |
| `minijuegos.js` | Combates: Jan-Ken, tres en raya, rimas, secuencia de ki, sigue la jarra, examen, reflejos y memoria |
| `idiomas.js` | Textos en castellano y català (`t()`), rimas y preguntas propias en català |
| `historia.js` | Modo Historia: guion bilingüe del Libro 1 y pintor de viñetas pixel-art (320×200) |

**No hace falta compilar.** Los archivos se sirven tal cual. Vue y Three.js se cargan desde CDN
(versiones fijadas en el `importmap` de `index.html`). Firebase solo se descarga si está configurado.

## Arrancar

Necesita un servidor estático (los módulos ES no funcionan abriendo el archivo con doble clic):

```bash
npm start                    # = npx serve -l 5173 .   → http://localhost:5173
# o bien: python3 -m http.server 5173   ·   o la extensión Live Server de VS Code
```

Para abrirlo desde el móvil, usa la IP del ordenador en la misma wifi (`http://192.168.x.x:5173`).

Tests de la lógica (opcional, necesita Node): `npm install && npm test`.

## Firebase (opcional)

Sin configurar nada funciona en **modo local** (guarda en `localStorage`).
Para usar Firebase, rellena `FIREBASE_CONFIG` al principio de `app.js` y despliega:

```bash
firebase deploy --only firestore:rules,hosting
```

Para publicar misiones desde el panel Admin con Firebase, la cuenta necesita el custom claim
`admin: true` (se asigna con el Admin SDK: `setCustomUserClaims(uid, { admin: true })`).

## Qué incluye

- Globo 3D como **maqueta**: planeta de piezas con carretera, árboles, flores, casas-cúpula, nubes y peana con placa (el Planeta de Kaio replica la maqueta de referencia). 4 mundos: la Tierra, el Planeta de Kaio, Namek y la Tierra del Futuro (línea temporal paralela).
- **3 estilos gráficos** seleccionables en Ajustes: bloques de construcción, dibujo animado y pixel-art.
- Zoom con **pellizco de dos dedos** (y rueda del ratón) en el globo y en los lugares.
- Viaje en la Nube Kinton: **modo libre** o **modo dados** (con casillas-evento), seleccionable en Ajustes.
- 4 lugares jugables (Montaña Paoz, Kame House, Capsule Corp, Torre Karin) y 4 misiones encadenadas.
- **Música FM estilo AdLib / Sound Blaster** (PC de los 90) con 11 temas originales, o chiptune de consola (Ajustes).
- **Diálogos en bocadillos de cómic** (cartela del narrador, gritos, pensamientos) con tipo de letra, tamaño y velocidad ajustables.
- Panel Admin (`#/admin`): misiones DLC y editor de personajes (crear nuevos, recortar de una lámina, retocar píxeles, tamaño en el juego).

## Modo Historia · Libro 1 «Las bolas de dragón»

| Cap. | Título | Lo vives como | Juego |
|---|---|---|---|
| 1 | El niño de la cola | Bulma | Buscar la bola en casa de Goku · memoria de cápsulas |
| 2 | La tortuga y el Maestro Roshi | Goku | Bastón Nyoibo contra el pterodáctilo · Jan-Ken con el oso · la nube Kinton |
| 3 | Oolong el terrible | Goku | Jan-Ken contra el monstruo · el examen de Bulma (caramelo pipí) |
| 4 | El bandido del desierto | Yamcha | Jan-Ken contra Goku (hasta que aparece Bulma...) |
| 5 | La princesa de la Montaña de Fuego | Chichí | Dinosaurio · el primer Kamehameha de Goku |
| 6 | El deseo de Oolong | Oolong | Gritar el deseo antes que Pilaf · Ozaru bajo la luna llena |

Cada página es una viñeta: de lectura (tocar para avanzar), de **exploración** (tocar las pistas
brillantes) o de **combate** (minijuego). Los capítulos se desbloquean en orden y el progreso se guarda.
Para escribir capítulos nuevos: `BOOKS` en `historia.js` (cada texto como `{ es, ca }`).

## Guion del Mundo 1 · La Tierra

| Lugar | Misión | Minijuego |
|---|---|---|
| Montaña Paoz | Recuerdo: la esfera de cuatro estrellas (jugando con Goku niño) | Jan-Ken contra el dinosaurio |
| Montaña Paoz | ¡Gohan tiene que estudiar! | Examen sorpresa de Chichí |
| Montaña Paoz | La cena de los Saiyans | Reflejos: pesca con la cola |
| Kame House | La reunión en Kame House | Duelo de rimas con Roshi |
| Kame House | ¿Dónde están mis gafas? | Sigue la concha de Umigame |
| Kame House | El hermano del espacio (Raditz) | Jan-Ken contra Raditz + carga del Makankosappo |
| Capsule Corp | El radar del dragón | Secuencia de ki + 3 en raya con Oolong |
| Capsule Corp | El lío de las cápsulas | Memoria de cápsulas |
| Capsule Corp | El scouter de Raditz | Reflejos: sintonizar el scouter |
| Torre Karin | El agua ultrasagrada | Sigue la jarra |
| Torre Karin | Las adivinanzas de Karin | Adivinanzas |

## Crear misiones (DLC)

Las misiones son datos JSON. Desde `#/admin` → **Nueva** se parte de una plantilla. Pasos disponibles:

- `talk` / `goto`: hablar con un prop o acercarse a él (`target` = id del prop).
- `battle`: minijuego (`game`: `rps`, `tictactoe`, `rhyme`, `kiseq`, `shell`, `quiz`, `reflex`, `memory`) con `config` y los diálogos `win`/`lose`.
- `collect`: recoger un objeto (`item`).

Con `spawns` se añaden NPCs u objetos al mapa entre los pasos `fromStep` y `untilStep`.
`requires` encadena misiones y `reward` da zenis, objetos y personajes nuevos.
Una misión publicada con el mismo `id` que una base la sustituye.

## Personajes con imágenes propias

En `#/personajes` (o Admin → Personajes):

- **＋ Nuevo personaje**: crea uno que falte (p. ej. Mai o Yajirobe) y aparece en «Personalizados».
- **🗂 Recortar de lámina**: sube una lámina con muchos sprites, el juego detecta cada personaje y
  al tocarlo lo pasa al editor ya sin fondo.
- **🖼 Importar imagen**: un sprite suelto (detecta la rejilla del pixel-art y quita el fondo).
- Editor de píxeles (pintar, borrar, rellenar, cuentagotas, recolorear), **tamaño en el juego**
  (niño, adulto, gigante...) y vista previa 3D. «📋 Copiar código» da el sprite listo para `personajes.js`.

## Móvil nativo

Para publicar como app se puede empaquetar con Capacitor, usando como `webDir` una carpeta con
los 10 archivos. Para que funcione sin conexión, descarga Vue y Three.js junto a ellos y cambia las
URLs del `importmap`.

## Aviso legal

Dragon Ball y sus personajes pertenecen a Bird Studio/Shueisha, Toei Animation y Bandai Namco.
Este proyecto es un fan game personal y sin ánimo de lucro. No se debe publicar en tiendas ni
monetizar sin licencia. La música y los escenarios son originales (inspirados en el ambiente de
la serie). Los sprites de personajes proceden de láminas de pixel-art hechas por fans: antes de
publicar hay que pedir permiso y acreditar a sus autores.
