# 007 · Mensajería interna

**Estado:** implementado ✅

## Qué hace

Mensajería uno-a-uno entre usuarios de cualquier rol: elige a un destinatario (buscando por nombre o correo), envía mensajes y ve la conversación con indicadores de leído/no leído. Aporta una campana de "mensajes no leídos" en la cabecera junto al resto de notificaciones.

## Por qué

Es el canal de comunicación interno que conecta a profesores, estudiantes, acudientes y administración dentro de la misma plataforma, sin depender de WhatsApp ni de correos dispersos.

## Criterios de aceptación

- [x] Un usuario envía mensajes a cualquier otro usuario activo del sistema.
- [x] El remitente ve sus conversaciones y el destinatario recibe el mensaje con la marca `leido` en 0.
- [x] Al abrir la conversación, los mensajes entrantes se marcan como leídos.
- [x] Los mensajes no leídos se reflejan en la campana (notificación tipo `mensaje`).
- [x] El acceso a un mensaje se restringe a remitente y destinatario (403 al tercero).
- [x] Los mensajes se muestran ordenados por fecha dentro de cada conversación.

## Fuera de alcance

- Grupos o salas de chat (solo conversaciones individuales).
- Adjuntos, edición o borrado de mensajes, y lectura de conversaciones ajenas por parte del admin.