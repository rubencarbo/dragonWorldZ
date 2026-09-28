# DragonWorldZ 🐉

Prototipo de juego para smartphone inspirado en Dragon Ball (**fan game sin ánimo de lucro**).
Hecho con **Vue 3 + Three.js + Firebase**, sin paso de compilación.

El mundo es una **bola 3D** que giras con el dedo. En cada lugar el personaje camina por un
escenario de vóxeles con estética **retro 8 bits**, habla con NPCs y supera **misiones** cuyos
combates son **juegos infantiles**.

## Estructura (8 archivos)

| Archivo | Contenido |
|---|---|
| `index.html` | Página, importmap con las librerías (Vue y Three.js desde CDN) |
| `estilos.css` | Estética retro 8 bits: base, componentes, pantallas y minijuegos |
| `app.js` | Arranque: Firebase, guardado, estado de la partida, misiones, navegación, diálogos y combates |
| `pantallas.js` | Globo 3D, lugar (tocar para caminar), ajustes y panel Admin |
| `motor.js` | Renderer retro, vóxeles, modelos 3D, planeta procedural, música chiptune, lógica de misiones y pathfinding |
| `personajes.js` | Sprites de los protagonistas y sus transformaciones (`SPRITES`, `FORMS`) y generador de personajes secundarios (`CHARACTER_SPECS`) |
| `mundos.js` | Mundos, mapas de cada lugar, misiones base y pistas de música |
| `minijuegos.js` | Combates: Jan-Ken, tres en raya, rimas, secuencia de ki y sigue la jarra |

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
- Música chiptune original en bucle para cada lugar, más efectos de sonido.
- Panel Admin (`#/admin`): misiones DLC y conversión de imágenes de personajes a sprites 8 bits.

## Crear misiones (DLC)

Las misiones son datos JSON. Desde `#/admin` → **Nueva** se parte de una plantilla. Pasos disponibles:

- `talk` / `goto`: hablar con un prop o acercarse a él (`target` = id del prop).
- `battle`: minijuego (`game`: `rps`, `tictactoe`, `rhyme`, `kiseq`, `shell`) con `config` y los diálogos `win`/`lose`.
- `collect`: recoger un objeto (`item`).

Con `spawns` se añaden NPCs u objetos al mapa entre los pasos `fromStep` y `untilStep`.
`requires` encadena misiones y `reward` da zenis, objetos y personajes nuevos.
Una misión publicada con el mismo `id` que una base la sustituye.

## Personajes con imágenes propias

En `#/admin` → **Sprites** sube una imagen PNG del personaje (de frente y con fondo transparente).
Se reduce a pixel-art con paleta limitada (tamaño y número de colores ajustables) y el juego la
extruye a vóxeles 3D.

## Móvil nativo

Para publicar como app se puede empaquetar con Capacitor, usando como `webDir` una carpeta con
los 8 archivos. Para que funcione sin conexión, descarga Vue y Three.js junto a ellos y cambia las
URLs del `importmap`.

## Aviso legal

Dragon Ball y sus personajes pertenecen a Bird Studio/Shueisha, Toei Animation y Bandai Namco.
Este proyecto es un fan game personal y sin ánimo de lucro. No se debe publicar en tiendas ni
monetizar sin licencia. Toda la música y el arte provisional son originales.
