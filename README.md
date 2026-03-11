# Mico Nutri Heald

Sistema de gestion nutricional clinico construido con Next.js 16 y Supabase.

La arquitectura sigue el flujo real de trabajo definido para consulta nutricional:

1. abrir paciente
2. revisar evaluacion
3. definir objetivo
4. prescribir plan alimentario
5. registrar consumo real
6. comparar plan contra consumo
7. revisar evolucion y ajustar

## Stack

- Next.js 16 con App Router
- TypeScript
- Tailwind CSS 4
- Supabase Auth + Postgres + RLS
- SQL clinico apoyado en `public.alimentos_26_grupos`

## Ya implementado en esta primera fase

- Landing y estructura base de app
- Integracion Supabase SSR para server, browser y proxy
- Acceso con sign in / sign up
- Pantalla inicial de dashboard
- Modulo inicial de pacientes con alta rapida
- Migracion SQL base para:
	- roles y perfiles
	- pacientes y ficha clinica minima
	- mediciones y evaluaciones
	- objetivos
	- planes alimentarios
	- consumo real
	- snapshots de progreso
	- referencias nutricionales
	- RLS por rol
	- vistas de calculo nutricional y comparacion plan vs consumo

## Tabla maestra de alimentos

La app asume que `public.alimentos_26_grupos` ya existe en Supabase y no la duplica.

Toda la logica clinica y operativa referencia directamente `public.alimentos_26_grupos(id)`.

## Variables de entorno

Crea un `.env.local` usando `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Desarrollo

Instalar dependencias:

```bash
npm install
```

Levantar el proyecto:

```bash
npm run dev
```

Validar calidad:

```bash
npm run lint
npm run typecheck
npm run build
```

## Migracion SQL

La base inicial del sistema esta en:

`supabase/migrations/20260310_000001_clinical_foundation.sql`

Esa migracion:

- crea enums y tablas clinicas
- agrega funciones de calculo
- crea vistas nutricionales
- configura RLS
- inserta roles y tipos de comida base

## Siguiente fase recomendada

1. conectar un proyecto Supabase real y ejecutar la migracion
2. asignar roles reales en `public.user_roles`
3. construir objetivos, planes y consumo real con formularios completos
4. abrir reportes diarios, semanales, mensuales y anuales
5. agregar vistas simple/completa para nutricionista y vista liviana para paciente
