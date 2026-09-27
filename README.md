# DragonWorldZ 🐉

Prototipo de juego para smartphone inspirado en Dragon Ball (**fan game sin ánimo de lucro**).
Hecho con **Vue 3 + Pinia + Three.js + Firebase**.

El mundo es una **bola 3D** que giras con el dedo. En cada lugar el personaje camina por un
escenario de vóxeles con estética **retro 8 bits**, habla con NPCs y supera **misiones** cuyos
combates son **juegos infantiles**.

## Arrancar

```bash
npm install
npm run dev      # http://localhost:5173 (usa --host, así que también se abre desde el móvil en la misma red)
npm test         # tests de lógica (minijuegos, misiones, datos)
npm run build
```

Sin configurar nada funciona en **modo local** (guarda en `localStorage`).
Para usar Firebase copia `.env.example` a `.env.local` y rellena las claves. Después:

```bash
firebase deploy --only firestore:rules,hosting
```

Para publicar misiones desde el panel Admin con Firebase, la cuenta necesita el custom claim
`admin: true` (se asigna con el Admin SDK: `setCustomUserClaims(uid, { admin: true })`).

## Qué incluye este prototipo

| Pieza | Dónde |
|---|---|
| Globo 3D low-poly procedural, mundos (Tierra, Planeta de Kaio, Namek, Tierra del Futuro como línea paralela) | `src/views/GlobeView.vue`, `src/engine/globe.js`, `src/data/worlds.js` |
| Viaje en la Nube Kinton. **Modo libre** (vuela directo) o **modo dados** (casillas por el camino con eventos aleatorios) | `GlobeView.vue` |
| Lugares ampliados con mapas de casillas, tocar para caminar (pathfinding) y dado en modo dados | `src/views/LocationView.vue`, `src/data/maps.js` |
| 4 lugares: Montaña Paoz, Kame House, Capsule Corp, Torre Karin | `src/data/maps.js` |
| 4 misiones encadenadas | `src/data/missions.js` |
| Minijuegos de combate: Jan-Ken (piedra, papel o tijera, con pistas del rival), tres en raya, duelo de rimas, secuencia de ki (tipo Simón), sigue la jarra (trile) | `src/minigames/` |
| Música chiptune original en bucle para cada mundo/lugar + efectos, sintetizada con WebAudio | `src/engine/chiptune.js`, `src/data/music.js` |
| Personajes como sprites pixel-art extruidos a vóxeles 3D | `src/data/characters.js`, `src/engine/voxel.js` |
| Panel Admin: editar, validar, publicar, importar y exportar misiones (packs DLC). Convertir imágenes de personajes a sprites 8 bits | `src/views/AdminView.vue` (`#/admin`) |
| Ajustes: modo de avance, nivel de pixelado, volumen, borrar partida | `src/views/SettingsView.vue` |

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

Para publicar como app se puede empaquetar con Capacitor:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init DragonWorldZ com.dragonworldz.app --web-dir dist
npm run build && npx cap add android && npx cap sync
```

## Aviso legal

Dragon Ball y sus personajes pertenecen a Bird Studio/Shueisha, Toei Animation y Bandai Namco.
Este proyecto es un fan game personal y sin ánimo de lucro. No se debe publicar en tiendas ni
monetizar sin licencia. Toda la música y el arte provisional son originales.
