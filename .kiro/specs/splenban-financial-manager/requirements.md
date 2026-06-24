# Requirements Document

## Introduction

SplenBan es una aplicación web de gestor financiero personal con diseño minimalista blanco/negro, construida en HTML, CSS y JavaScript puro (sin frameworks). Permite al usuario registrar ingresos y gastos, visualizarlos gráficamente por períodos (Día, Semana, Mes, Año), consultar transacciones recientes y aprovechar IA para categorización automática. La persistencia opera completamente en el cliente mediante `localStorage`.

## Glossary

- **App**: Controlador principal de la aplicación (`script.js`). Orquesta todos los módulos.
- **Store**: Módulo de persistencia (`store.js`). Abstrae el acceso a `localStorage`.
- **Chart**: Módulo de gráfica (`chart.js`). Dibuja la gráfica de línea suave en un `<canvas>`.
- **AICategorzier**: Módulo de categorización automática (`ai.js`). Asigna una categoría a cada transacción.
- **Modal**: Formulario flotante para capturar los datos de una nueva transacción.
- **Transaction**: Registro de un movimiento financiero (ingreso o gasto) con monto, descripción, categoría, tipo y fecha.
- **UserPreferences**: Configuración del usuario (nombre, clave API, moneda, tema).
- **ChartDataPoint**: Punto de datos para la gráfica: etiqueta de eje X, valor neto del período e indicador de período activo.
- **Period**: Uno de los cuatro intervalos de agregación temporal soportados: `"Día"`, `"Semana"`, `"Mes"`, `"Año"`.
- **Balance**: Suma neta de todos los ingresos menos todos los gastos registrados en el Store.

---

## Requirements

### Requisito 1: Inicialización de la aplicación

**Historia de usuario:** Como usuario, quiero que la aplicación cargue correctamente al abrir el navegador, para poder empezar a registrar mis finanzas sin configuración adicional.

#### Criterios de aceptación

1. WHEN el DOM termina de cargarse, THE App SHALL inicializar todos los módulos (Store, Chart, AICategorzier) en el orden correcto antes de presentar la interfaz al usuario.
2. WHEN el DOM termina de cargarse, THE App SHALL leer las transacciones existentes del Store y renderizar el balance, la lista de transacciones y la gráfica con el período `"Mes"` activo por defecto.
3. WHEN el DOM termina de cargarse y Store no contiene transacciones, THE App SHALL mostrar el mensaje `"No hay transacciones todavía"`, el balance `$0.00` y una gráfica plana en cero.
4. WHEN el DOM termina de cargarse, THE App SHALL cargar las preferencias del usuario (nombre, moneda) desde el Store y mostrarlas en el header.

---

### Requisito 2: Gestión de transacciones — Agregar

**Historia de usuario:** Como usuario, quiero agregar ingresos y gastos mediante un formulario, para mantener un registro preciso de mis movimientos financieros.

#### Criterios de aceptación

1. WHEN el usuario toca el botón `"+"`, THE App SHALL abrir el Modal mostrando los campos: monto, descripción y selector de tipo (Ingreso/Gasto).
2. WHEN el usuario confirma el formulario con un monto mayor a cero y un tipo válido (`"income"` o `"expense"`), THE App SHALL invocar `addTransaction(amount, description, type)` y cerrar el Modal.
3. IF el usuario confirma el formulario con un monto vacío, cero o negativo, THEN THE Modal SHALL mostrar el mensaje de validación `"Ingresa un monto válido mayor a 0"` sin cerrar el modal ni invocar `addTransaction`.
4. WHEN `addTransaction` es invocada con datos válidos, THE AICategorzier SHALL asignar una categoría a la transacción antes de persistirla.
5. WHEN `addTransaction` completa la categorización, THE Store SHALL persistir la transacción con los campos: `id` (UUID), `amount` (número positivo), `description` (string recortado), `category`, `type`, `date` (ISO 8601 generada automáticamente).
6. WHEN una transacción es persistida exitosamente, THE App SHALL actualizar el balance, la lista de transacciones y la gráfica en la misma operación de render.
7. WHERE el usuario no ingresa descripción, THE AICategorzier SHALL asignar la categoría `"Sin categoría"`.

---

### Requisito 3: Gestión de transacciones — Eliminar

**Historia de usuario:** Como usuario, quiero eliminar transacciones registradas por error, para mantener mis datos financieros limpios y exactos.

#### Criterios de aceptación

1. WHEN el usuario selecciona la opción de eliminar en una transacción de la lista, THE App SHALL invocar `deleteTransaction(id)`.
2. WHEN `deleteTransaction(id)` es invocada, THE Store SHALL eliminar la transacción con ese `id` de `localStorage`.
3. WHEN una transacción es eliminada, THE App SHALL recalcular y renderizar el balance, la lista de transacciones y la gráfica inmediatamente.
4. IF `deleteTransaction` es invocada con un `id` que no existe en el Store, THEN THE Store SHALL no modificar los datos y THE App SHALL no mostrar un error visible al usuario.

---

### Requisito 4: Balance en tiempo real

**Historia de usuario:** Como usuario, quiero ver mi balance actualizado en todo momento, para conocer mi situación financiera de un vistazo.

#### Criterios de aceptación

1. THE App SHALL calcular el balance como la suma de todos los `amount` con `type === "income"` menos la suma de todos los `amount` con `type === "expense"` del Store.
2. WHEN el balance es calculado, THE App SHALL formatearlo usando `Intl.NumberFormat` con el símbolo de moneda de las preferencias del usuario y mostrarlo en el elemento `#balance-amount` del DOM.
3. WHILE el balance calculado es menor a cero, THE App SHALL mostrar el valor en color `#c0392b` (rojo).
4. WHILE el balance calculado es mayor o igual a cero, THE App SHALL mostrar el valor en color `#000000` (negro).
5. WHEN se agrega o elimina una transacción, THE App SHALL actualizar el balance visible en el header dentro del mismo ciclo de render.

---

### Requisito 5: Gráfica de línea por período

**Historia de usuario:** Como usuario, quiero visualizar mis finanzas en una gráfica por período (Día, Semana, Mes, Año), para entender mis tendencias de gasto e ingreso a lo largo del tiempo.

#### Criterios de aceptación

1. THE App SHALL soportar cuatro períodos de visualización: `"Día"`, `"Semana"`, `"Mes"`, `"Año"`.
2. WHEN el usuario selecciona un período, THE App SHALL invocar `Store.getByPeriod(period, now)`, agregar los datos con `aggregateByPeriod` y redibujar la gráfica.
3. THE Chart SHALL dibujar una línea suave usando curvas Bézier sobre un elemento `<canvas>` nativo del browser.
4. WHEN Chart dibuja la gráfica, THE Chart SHALL resaltar el bucket activo con un punto negro, un halo blanco y una línea vertical punteada.
5. WHEN Chart dibuja la gráfica, THE Chart SHALL mostrar los labels del eje X con un pill negro sobre el label del período activo y labels planos para el resto.
6. WHEN `aggregateByPeriod` procesa un período, THE App SHALL generar exactamente los buckets temporales correspondientes: 24 horas para `"Día"`, 7 días para `"Semana"`, 5–6 meses para `"Mes"`, 5 años para `"Año"`.
7. WHEN `aggregateByPeriod` procesa las transacciones, THE App SHALL asegurar que exactamente un `ChartDataPoint` tenga `isActive === true` y que todos los buckets sean contiguos sin solapamiento.
8. WHEN Chart recibe un conjunto de `dataPoints` con todos los valores en cero, THE Chart SHALL dibujar una línea plana en el eje neutro sin errores.
9. IF el browser no soporta Canvas 2D API, THEN THE Chart SHALL mostrar el mensaje `"Tu navegador no soporta gráficas"` y THE App SHALL continuar funcionando con balance y lista de transacciones operativos.

---

### Requisito 6: Persistencia con localStorage

**Historia de usuario:** Como usuario, quiero que mis transacciones y preferencias se guarden automáticamente, para no perder mis datos al cerrar o recargar el navegador.

#### Criterios de aceptación

1. WHEN `Store.save(transaction)` es invocada, THE Store SHALL serializar la transacción a JSON y escribirla en `localStorage` antes de retornar.
2. WHEN `Store.getAll()` es invocada, THE Store SHALL deserializar y retornar todas las transacciones guardadas en `localStorage` como un array de `Transaction`.
3. WHEN `Store.delete(id)` es invocada, THE Store SHALL eliminar únicamente la transacción con ese `id` y reescribir el array actualizado en `localStorage`.
4. WHEN el usuario recarga la página, THE App SHALL recuperar y mostrar todas las transacciones previamente guardadas en `localStorage`.
5. IF `localStorage.setItem()` lanza `QuotaExceededError` o `SecurityError`, THEN THE Store SHALL capturar la excepción y THE App SHALL mostrar una notificación toast con el mensaje `"No se pudo guardar la transacción. Almacenamiento lleno."`.
6. THE Store SHALL aislar todas las operaciones de lectura y escritura en métodos propios, de modo que ningún otro módulo acceda directamente a `localStorage`.

---

### Requisito 7: Categorización automática con IA

**Historia de usuario:** Como usuario, quiero que mis transacciones sean categorizadas automáticamente, para organizar mis gastos sin esfuerzo manual.

#### Criterios de aceptación

1. THE AICategorzier SHALL soportar al menos las siguientes categorías: `"comida"`, `"transporte"`, `"entretenimiento"`, `"salud"`, `"ropa"`, `"hogar"`, `"educación"`, `"ingreso"`.
2. WHEN `AICategorzier.categorize(description)` es invocada con una descripción no vacía, THE AICategorzier SHALL comparar la descripción en minúsculas contra el diccionario de keywords y retornar la categoría correspondiente si hay coincidencia.
3. WHEN `AICategorzier.categorize(description)` es invocada con una descripción que no coincide con ningún keyword, THE AICategorzier SHALL retornar `"Otros"`.
4. WHEN `AICategorzier.categorize(description)` es invocada con una descripción vacía o compuesta solo de espacios, THE AICategorzier SHALL retornar `"Sin categoría"`.
5. WHERE el usuario ha configurado una API key de OpenAI, THE AICategorzier SHALL intentar primero la categorización vía API antes de usar el heurístico.
6. IF la llamada a la API de OpenAI falla (error HTTP, timeout u otro), THEN THE AICategorzier SHALL hacer fallback silencioso al modo heurístico y registrar el error en `console.warn`.
7. THE AICategorzier SHALL nunca propagar una excepción hacia el caller; `categorize(description)` SHALL siempre resolver la promesa con un string no vacío.

---

### Requisito 8: Preferencias del usuario

**Historia de usuario:** Como usuario, quiero configurar mi nombre, moneda y clave de API de IA, para personalizar la aplicación según mis necesidades.

#### Criterios de aceptación

1. THE Store SHALL persistir las preferencias del usuario (`userName`, `apiKey`, `currency`, `theme`) de forma separada a las transacciones en `localStorage`.
2. WHEN el usuario guarda sus preferencias, THE App SHALL actualizar el saludo en el header con el `userName` guardado.
3. WHEN el usuario guarda una `apiKey`, THE AICategorzier SHALL usar esa clave en las siguientes llamadas a la API de OpenAI.
4. WHERE el usuario configura el símbolo de moneda, THE App SHALL usar ese símbolo en todas las representaciones del balance y montos.
5. IF el usuario no ha configurado preferencias, THE Store SHALL retornar valores por defecto: `userName: ""`, `apiKey: ""`, `currency: "$"`, `theme: "light"`.

---

### Requisito 9: Lista de transacciones recientes

**Historia de usuario:** Como usuario, quiero ver un listado de mis transacciones más recientes, para revisar rápidamente mi actividad financiera.

#### Criterios de aceptación

1. THE App SHALL mostrar las transacciones almacenadas en orden cronológico inverso (la más reciente primero).
2. WHEN se renderiza la lista, THE App SHALL mostrar para cada transacción: monto formateado, descripción, categoría, tipo (Ingreso/Gasto) y fecha.
3. WHEN se agrega o elimina una transacción, THE App SHALL actualizar la lista de transacciones dentro del mismo ciclo de render.
4. WHILE el Store no contiene transacciones, THE App SHALL mostrar el mensaje `"No hay transacciones todavía"` en lugar de la lista.

---

### Requisito 10: Seguridad e integridad de datos

**Historia de usuario:** Como usuario, quiero que mis datos estén protegidos contra errores de entrada y vulnerabilidades, para confiar en la integridad de mi información financiera.

#### Criterios de aceptación

1. THE App SHALL insertar texto de usuario en el DOM usando exclusivamente `textContent` (nunca `innerHTML`), para prevenir inyección XSS.
2. THE App SHALL parsear el monto de toda transacción con `parseFloat()` y validar que el resultado sea mayor a cero antes de persistirlo.
3. THE App SHALL generar el `id` de cada transacción usando `crypto.randomUUID()`, garantizando unicidad sin dependencia de servidores externos.
4. THE Store SHALL almacenar la `apiKey` únicamente en `localStorage` del origen actual, sin transmitirla a ningún servidor propio de la aplicación.
5. IF una transacción ya ha sido guardada en el Store, THEN THE Store SHALL no permitir la modificación de sus campos `amount`, `type` o `date`; la única operación permitida sobre una transacción existente es eliminarla.
