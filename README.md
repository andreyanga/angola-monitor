# Angola Monitor

Plataforma inteligente de monitoramento preventivo ambiental para Angola, com dados meteorológicos e sensores IoT por província.

## Início rápido

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

Criar `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENWEATHER_API_KEY=
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Servidor de produção |
| `npm run lint` | Verificação ESLint |

## Documentação

Documentação completa do código, arquitectura, base de dados e APIs em **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

## Stack

Next.js 16 · React 19 · Supabase · Leaflet · OpenWeatherMap
