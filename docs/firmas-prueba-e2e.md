# Prueba de extremo a extremo: contrato con dos firmantes

Objetivo: comprobar que un mismo contrato lo firman dos personas (responsable y estudiante) con sus propios
enlaces, y que el PDF final trae las dos firmas. Tarda ~5 minutos.

## Preparación
- Tener aplicadas la migración `0018` y las funciones `firma-sesion` / `firma-enviar` (ver README).
- Un PDF de prueba de 2 páginas (cualquiera; sirve un contrato real o uno en blanco).
- Entrar como administrador (`aguasclaras713@gmail.com`).

## 1. Crear el contrato (admin)
1. Menú **Firmas** → **Nuevo contrato**.
2. Título: `PRUEBA firma`; habitación opcional; subir el PDF.
3. Dejar los dos firmantes (Responsable y Estudiante); ponerles nombre (p. ej. `Responsable Prueba`,
   `Estudiante Prueba`).
4. En "Casillas de firma", elegir **Responsable** y arrastrar sobre la página 1 un recuadro donde iría su
   firma. Elegir **Estudiante** y dibujar uno en la página 2 (y, si quieres, otro en la página 1).
   Verificar que cada casilla muestra el nombre y el color de su firmante.
5. **Crear y generar enlaces**. Deben aparecer dos enlaces con "Copiar enlace" y "Copiar mensaje de WhatsApp".
   Pegar el mensaje en un bloc de notas: debe decir
   `Hola Responsable Prueba, firma tu acuerdo de arrendamiento… aquí: https://…/firmar?t=…`.

## 2. Firma del primer firmante (en el celular o con el dev tools en modo móvil)
1. Abrir el enlace del **Responsable**. Debe verse la marca de Sol Estudio HAB, el título, su nombre y rol,
   el PDF y **solo sus** casillas en dorado.
2. Tocar **Firmar** → dibujar → **Aplicar**. La firma aparece dentro de su casilla.
3. Sin marcar la aceptación, **Enviar firma** debe estar deshabilitado. Marcarla y enviar.
4. Debe salir "¡Listo! Tu firma quedó registrada." con **Descargar mi copia**. El PDF descargado trae su firma.
5. Recargar el mismo enlace: debe decir "Este documento ya fue firmado" y ofrecer la descarga.

## 3. Firma del segundo firmante
1. En el admin → **Firmas**: el contrato está en **Firma parcial** y el Responsable figura como firmado.
2. Abrir el enlace del **Estudiante** y firmar igual que antes.
3. Descargar su copia: debe traer **las dos firmas** (la del Responsable ya estampada + la suya).

## 4. Verificación del admin
- En **Firmas** el contrato pasa a **Completado**, con fecha y hora de cada firma.
- **Descargar PDF firmado** abre el PDF con todas las firmas en su casilla.
- Probar un enlace inventado (`/firmar?t=abc`): debe decir "Enlace inválido o vencido".
- **Eliminar** el contrato de prueba: desaparece de la lista y se borran sus archivos.

## 5. Firma del arrendador, vínculo con el huésped y copia por correo
Repite la prueba con tres firmantes (Arrendador, Estudiante, Responsable) y un huésped que ya exista con
estadía vigente (usa la cuenta de pruebas, habitación 301, para no escribirle a nadie real):
1. En **Nuevo contrato** elige el huésped en "Huésped existente" (rellena la habitación y los datos del
   Estudiante); pon un correo tuyo al Arrendador y al Responsable. Dibuja las tres casillas.
2. En **Firmas**, el Arrendador muestra **Cargar firma (imagen)**: sube una foto/escaneo de una firma; en la
   vista previa el fondo debe verse transparente. **Aplicar firma**: debe aparecer como firmado y la firma en
   su recuadro del PDF (descarga el PDF para comprobarlo).
3. Firma el Estudiante y el Responsable con sus enlaces. Con la última firma el contrato pasa a **Completado**.
4. Comprueba:
   - En **Firmas** dice "Ya está en sus contratos (mismo archivo)" y "Copia firmada enviada por correo el …".
   - En el **detalle del huésped → Contratos** aparece el contrato "Firmado digitalmente por todas las partes"
     (sin botón de "aún no confirmado") y **Ver contrato** abre el mismo PDF. En Mi perfil del huésped también.
   - En tu correo llegó la copia con asunto `Acuerdo Firmado <Nombre> H301 <inicio> - <fin>` y el PDF adjunto.
5. **Sin estadía:** crea otro contrato con una habitación sin acuerdo activo y complétalo: dice que la copia
   está pendiente y no se envía nada. Luego, al vincularlo a un huésped con estadía (o cuando la registres),
   usa **Enviar copia por correo**.
6. Eliminar el contrato de prueba desde Firmas también lo quita de los contratos del huésped.

## Prueba de firma simultánea (opcional)
Abrir los dos enlaces en dos navegadores, preparar la firma en ambos y pulsar **Enviar firma** casi al
mismo tiempo. El resultado debe seguir teniendo las dos firmas (el servidor reintenta sobre la última
versión del PDF).
