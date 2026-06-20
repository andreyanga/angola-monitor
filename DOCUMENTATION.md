# Angola Monitor — Documentação do Código

Plataforma web de monitoramento ambiental preventivo para Angola. O sistema apresenta dados meteorológicos e de sensores IoT por província, município e zona, com mapas interativos e painéis em tempo real.

---

## Índice

1. [Visão geral](#visão-geral)
2. [Stack tecnológica](#stack-tecnológica)
3. [Estrutura do projeto](#estrutura-do-projeto)
4. [Variáveis de ambiente](#variáveis-de-ambiente)
5. [Base de dados (Supabase)](#base-de-dados-supabase)
6. [Páginas](#páginas)
7. [Componentes](#componentes)
8. [API Routes](#api-routes)
9. [Bibliotecas auxiliares](#bibliotecas-auxiliares)
10. [Fluxo de dados](#fluxo-de-dados)
11. [Como executar](#como-executar)
12. [Notas e limitações](#notas-e-limitações)

---

## Visão geral

O **Angola Monitor** é uma aplicação **Next.js 16** (App Router) que funciona como dashboard de monitoramento ambiental. As funcionalidades principais são:

- **Dashboard nacional** (`/`): mapa interativo das 21 províncias de Angola, cartões de estatísticas agregadas e painel lateral com detalhes da província seleccionada.
- **Página de província** (`/provincia/[slug]`): informações detalhadas, meteorologia actual, histórico de leituras, mapa local com sensores IoT e lista de municípios/zonas.
- **Sincronização meteorológica** (`GET /api/weather`): endpoint que consulta a OpenWeatherMap para todas as províncias e grava os resultados no Supabase.

A interface usa um tema escuro com destaques em verde (`#22c55e`), orientada para operadores de monitoramento ambiental.

---

## Stack tecnológica

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 16.2.6 | Framework React com App Router |
| React | 19.2.4 | Interface de utilizador |
| TypeScript | ^5 | Tipagem nas páginas `.tsx` |
| Tailwind CSS | ^4 | Estilos globais (layout base) |
| Supabase | ^2.106 | Base de dados e API backend |
| Leaflet + react-leaflet | 1.9.4 / 5.0 | Mapas interativos (GeoJSON) |
| Recharts | ^3.8 | Gráficos (dependência instalada; ainda não utilizada no código) |
| OpenWeatherMap | API externa | Dados meteorológicos |

---

## Estrutura do projeto

```
angola-monitor/
├── app/
│   ├── layout.tsx              # Layout raiz, fontes Geist, metadata
│   ├── page.tsx                # Dashboard principal (página inicial)
│   ├── globals.css             # Estilos globais Tailwind
│   ├── api/
│   │   └── weather/
│   │       └── route.js        # Endpoint de sincronização meteorológica
│   └── provincia/
│       └── [slug]/
│           └── page.tsx        # Página de detalhe por província
├── components/
│   ├── AngolaMap.jsx           # Mapa nacional com GeoJSON das províncias
│   └── ProvinceMap.jsx         # Mapa de uma província com marcadores de sensores
├── lib/
│   └── supabase.js             # Cliente Supabase singleton
├── public/
│   └── data/
│       └── angola-provinces.json   # GeoJSON das províncias (necessário adicionar)
├── package.json
├── next.config.ts
├── tsconfig.json
└── DOCUMENTATION.md            # Este ficheiro
```

---

## Variáveis de ambiente

Criar um ficheiro `.env.local` na raiz do projeto:

```env
# Supabase (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://<projecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave-anonima>

# OpenWeatherMap (obrigatório para /api/weather)
OPENWEATHER_API_KEY=<chave-api>
```

| Variável | Exposta ao browser | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave pública anónima do Supabase |
| `OPENWEATHER_API_KEY` | Não | Chave da API OpenWeatherMap (apenas servidor) |

---

## Base de dados (Supabase)

O código assume as seguintes tabelas e relações. Os nomes e campos foram inferidos das queries existentes.

### `provinces`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | number | Identificador único |
| `name` | string | Nome da província |
| `slug` | string | Identificador URL (ex.: `luanda`, `cuanza-norte`) |
| `capital` | string | Capital provincial |
| `area_km2` | number | Área em km² |
| `num_municipios` | number | Número de municípios |
| `languages` | string | Línguas faladas |
| `founded` | string | Data de fundação |
| `latitude` | number | Latitude do centro |
| `longitude` | number | Longitude do centro |

### `weather_data`

| Campo | Tipo | Descrição |
|---|---|---|
| `province_id` | number | FK → `provinces.id` |
| `temperature` | number | Temperatura em °C |
| `humidity` | number | Humidade em % |
| `wind_speed` | number | Velocidade do vento (m/s) |
| `wind_direction` | string | Direcção em graus |
| `pressure` | number | Pressão atmosférica (hPa) |
| `description` | string | Descrição do tempo |
| `icon` | string | Código de ícone OpenWeather |
| `recorded_at` | timestamp | Data/hora da leitura (gerado pelo Supabase) |

### `municipalities`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | number | Identificador único |
| `name` | string | Nome do município |
| `slug` | string | Identificador URL |
| `province_id` | number | FK → `provinces.id` |

### `zones`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | number | Identificador único |
| `name` | string | Nome da zona |
| `slug` | string | Identificador URL |
| `latitude` | number | Coordenada da zona |
| `longitude` | number | Coordenada da zona |
| `municipality_id` | number | FK → `municipalities.id` |

### `sensors`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | number | Identificador único |
| `name` | string | Nome do sensor |
| `sensor_type` | string | Tipo (ex.: temperatura, humidade) |
| `is_active` | boolean | Estado activo/inactivo |
| `zone_id` | number | FK → `zones.id` |

### `sensor_readings`

| Campo | Tipo | Descrição |
|---|---|---|
| `sensor_id` | number | FK → `sensors.id` |
| `value` | number | Valor medido |
| `unit` | string | Unidade de medida |
| `sensor_type` | string | Tipo do sensor |
| `status` | string | Estado da leitura |
| `recorded_at` | timestamp | Data/hora da leitura |

### Diagrama de relações

```
provinces
    ├── weather_data (1:N)
    └── municipalities (1:N)
            └── zones (1:N)
                    └── sensors (1:N)
                            └── sensor_readings (1:N)
```

---

## Páginas

### `app/page.tsx` — Dashboard principal

**Tipo:** Client Component (`'use client'`)

**Responsabilidades:**
- Carregar os dados meteorológicos mais recentes de cada província via Supabase.
- Renderizar cartões de estatísticas (províncias monitoradas, temperatura média/máxima, humidade média).
- Exibir o mapa nacional (`AngolaMap`) com interacção por clique.
- Mostrar painel lateral com dados da província seleccionada.
- Listar temperaturas por província ordenadas (maior → menor).
- Navegar para `/provincia/[slug]` ao clicar em "Ver Detalhes Completos".

**Estado local:**

| Estado | Tipo | Descrição |
|---|---|---|
| `selectedProvince` | `string \| null` | Nome da província seleccionada no mapa |
| `weatherData` | `WeatherData[]` | Última leitura por província |
| `currentTime` | `string` | Data/hora formatada em `pt-AO` |

**Query Supabase:**
```sql
SELECT *, provinces(name)
FROM weather_data
ORDER BY recorded_at DESC
```
O código filtra no cliente para manter apenas a leitura mais recente por `province_id`.

**Import dinâmico:** `AngolaMap` é carregado com `dynamic(..., { ssr: false })` porque Leaflet não suporta Server-Side Rendering.

---

### `app/provincia/[slug]/page.tsx` — Detalhe da província

**Tipo:** Client Component

**Parâmetro de rota:** `slug` — identificador URL da província (ex.: `benguela`, `cuanza-norte`).

**Responsabilidades:**
- Buscar dados da província, meteorologia, histórico e hierarquia município → zona → sensor.
- Para cada sensor, buscar a última leitura em `sensor_readings`.
- Renderizar mapa provincial (`ProvinceMap`) com marcadores de sensores.
- Exibir condições meteorológicas actuais e histórico das últimas 10 leituras.
- Listar municípios, zonas e sensores IoT com estado activo/inactivo.

**Interfaces TypeScript definidas:**
- `Province`, `WeatherData`, `Municipality`, `Zone`, `Sensor`, `SensorReading`

**Função auxiliar:** `getWindDirection(deg)` — converte graus (0–360) em pontos cardeais em português (Norte, Nordeste, etc.).

**Navegação pendente:** o botão "Ver município" aponta para `/municipio/${mun.slug}`, mas essa rota ainda não existe no projecto.

---

### `app/layout.tsx` — Layout raiz

**Tipo:** Server Component

Define metadata da aplicação, carrega as fontes **Geist** e **Geist_Mono** via `next/font/google`, e aplica `globals.css`. O `lang` do HTML está definido como `"en"` (pode ser alterado para `"pt"`).

---

## Componentes

### `components/AngolaMap.jsx`

Mapa interactivo de Angola usando **react-leaflet**.

| Prop | Tipo | Descrição |
|---|---|---|
| `onProvinceClick` | `function` | Callback chamado com o nome da província ao clicar |
| `weatherData` | `array` | Dados meteorológicos (recebido mas ainda não usado para colorir províncias) |

**Comportamento:**
- Carrega GeoJSON de `/data/angola-provinces.json`.
- Cada feature GeoJSON tem `properties.NAME_1` com o nome da província.
- Estilo padrão: preenchimento verde (`#22c55e`), opacidade 0.7.
- Tooltip permanente com o nome da província no centro do polígono.
- Efeitos hover (aumenta opacidade e espessura da borda) e click (chama `onProvinceClick`).
- Tile layer: CartoDB Dark (`basemaps.cartocdn.com/dark_all`).
- Centro: `[-11.2, 17.8]`, zoom 5, altura 600px.

**Nota:** `riskColors` define cores para estados Normal/Atenção/Alerta, mas actualmente todas as províncias usam `riskColors.normal`.

---

### `components/ProvinceMap.jsx`

Mapa focado numa única província com marcadores de sensores.

| Prop | Tipo | Descrição |
|---|---|---|
| `provinceName` | `string` | Nome da província para filtrar o GeoJSON |
| `latitude` | `number` | Centro do mapa |
| `longitude` | `number` | Centro do mapa |
| `municipalities` | `array` | Municípios com zonas e sensores aninhados |

**Comportamento:**
- Filtra o GeoJSON nacional para mostrar apenas a província actual (comparação normalizada, sem acentos).
- Renderiza `Marker` para cada sensor, posicionado nas coordenadas da zona (fallback para coordenadas da província).
- Popup com nome do sensor, zona, município, tipo e estado.
- Corrige ícones do Leaflet para compatibilidade com Next.js (URLs do unpkg).
- Centro dinâmico, zoom 7, altura 350px.

---

## API Routes

### `GET /api/weather`

**Ficheiro:** `app/api/weather/route.js`

**Função:** Sincronizar dados meteorológicos de todas as 21 províncias de Angola com a OpenWeatherMap e gravar no Supabase.

**Fluxo:**
1. Lê `OPENWEATHER_API_KEY` das variáveis de ambiente.
2. Itera sobre o array estático `provinces` (21 entradas com `id`, `name`, `capital`, `lat`, `lon`).
3. Para cada província, faz `fetch` à API OpenWeatherMap (`/data/2.5/weather`) com `units=metric` e `lang=pt`.
4. Mapeia a resposta para o formato `weather_data` e faz `insert` no Supabase.
5. Retorna JSON com `{ success, total, data }`.

**Resposta de exemplo:**
```json
{
  "success": true,
  "total": 21,
  "data": [
    {
      "province": "Luanda",
      "province_id": 13,
      "temperature": 28.5,
      "humidity": 75,
      "wind_speed": 3.2,
      "wind_direction": "180",
      "pressure": 1013,
      "description": "céu limpo"
    }
  ]
}
```

**Uso típico:** chamar periodicamente via cron job (Vercel Cron, GitHub Actions, etc.) para manter os dados actualizados.

**Tratamento de erros:** cada província é processada individualmente; falhas são capturadas e incluídas no array de resultados com campo `error`.

---

## Bibliotecas auxiliares

### `lib/supabase.js`

Cliente Supabase singleton exportado para toda a aplicação.

```javascript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```

Usado directamente nos Client Components (`page.tsx`, `provincia/[slug]/page.tsx`) e na API Route (`weather/route.js`).

---

## Fluxo de dados

```
┌─────────────────┐     GET /api/weather      ┌──────────────────┐
│  OpenWeatherMap │ ◄──────────────────────── │  Next.js Server  │
└─────────────────┘                           └────────┬─────────┘
                                                       │ insert
                                                       ▼
┌─────────────────┐     select/insert         ┌──────────────────┐
│   Browser UI    │ ◄────────────────────────►│    Supabase      │
│  (React pages)  │                           │   (PostgreSQL)   │
└─────────────────┘                           └──────────────────┘
        │
        │ fetch GeoJSON
        ▼
┌─────────────────┐
│ angola-provinces│
│     .json       │
└─────────────────┘
```

### Dashboard (`/`)

1. `useEffect` → `supabase.from('weather_data').select('*, provinces(name)')`
2. Filtra última leitura por `province_id`
3. Calcula médias e extremos no cliente
4. Passa `weatherData` ao `AngolaMap` e renderiza painel lateral

### Página de província (`/provincia/[slug]`)

1. Busca província por `slug`
2. Busca últimas 10 leituras meteorológicas
3. Busca municípios com zonas e sensores (query aninhada)
4. Para cada sensor, busca última leitura em `sensor_readings` (N+1 queries)
5. Renderiza mapa, meteorologia, histórico e lista de sensores

### Geração de slug (navegação)

```javascript
selectedProvince
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')  // remove acentos
  .replace(/ /g, '-')                // espaços → hífens
```

Exemplo: `"Cuanza Norte"` → `"cuanza-norte"`

---

## Como executar

### Pré-requisitos

- Node.js 18+
- Conta Supabase com tabelas configuradas
- Chave OpenWeatherMap (para sincronização meteorológica)
- Ficheiro GeoJSON em `public/data/angola-provinces.json`

### Instalação

```bash
npm install
```

### Configuração

```bash
# Criar .env.local com as variáveis descritas acima
cp .env.example .env.local   # se existir template
```

### Desenvolvimento

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Produção

```bash
npm run build
npm start
```

### Sincronizar meteorologia

```bash
curl http://localhost:3000/api/weather
```

### Lint

```bash
npm run lint
```

---

## Notas e limitações

| Item | Estado |
|---|---|
| Rota `/municipio/[slug]` | Referenciada no código, mas não implementada |
| `angola-provinces.json` | Necessário em `public/data/`; não incluído no repositório |
| Coloração por risco no mapa | `riskColors` definido mas não aplicado com base em `weatherData` |
| Recharts | Instalado mas sem uso actual |
| Metadata do layout | Ainda com valores genéricos do `create-next-app` |
| Queries N+1 na página de província | Uma query por sensor para `sensor_readings`; pode ser optimizado com joins ou RPC Supabase |
| `weatherData` no `AngolaMap` | Prop recebida mas não utilizada para estilizar províncias |
| SSR dos mapas | Desactivado intencionalmente (`ssr: false`) por limitação do Leaflet |
| Estilos | Maioria inline via `style={{}}`; Tailwind usado apenas no layout base |

---

## Convenções de código

- **Páginas principais:** TypeScript (`.tsx`) com interfaces explícitas.
- **Componentes de mapa e API:** JavaScript (`.jsx`/`.js`).
- **Client Components:** todas as páginas e componentes de mapa usam `'use client'`.
- **Importações:** alias `@/` aponta para a raiz do projecto (configurado no `tsconfig.json`).
- **Idioma da UI:** português de Angola (`pt-AO` para datas; textos em português europeu/angolano).
- **Navegação:** `window.location.href` em vez de `useRouter` do Next.js.

---

*Documentação gerada com base no código-fonte do projecto angola-monitor v0.1.0.*
