# ═══════════════════════════════════════
# CriaLook — Dockerfile para VPS
# ═══════════════════════════════════════

# ── Stage 1: Install dependencies ──
# Inclui devDependencies porque o build precisa de TS/ESLint.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

# Copia deps primeiro (cache-friendly: muda só se package-lock.json mudar)
COPY --from=deps /app/node_modules ./node_modules

# Agora copia arquivos de configuração (muda raramente)
COPY package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs ./
COPY sentry.*.config.ts ./

# Por fim copia src/ e public/ (muda a cada commit)
COPY public ./public
COPY src ./src
COPY supabase ./supabase

# Build args para variáveis públicas (necessárias no build time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/gerar
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
ARG NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME=CriaLook

RUN npm run build

# ── Stage 3: Runtime (imagem mínima, non-root) ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user (reduz blast radius de RCE)
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Copiar apenas o necessário da build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
