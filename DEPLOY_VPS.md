# 🚀 CriaLook — Checklist de Deploy VPS

> Ordem de execução para colocar o CriaLook em produção.

---

## Fase 1: VPS Pronta ✅

- [x] VPS ativa com Ubuntu/Debian
- [x] Node.js 20+ instalado
- [x] Git instalado
- [x] Domínio `crialook.com.br` registrado

## Fase 2: Código na VPS

- [ ] Clonar repositório
  ```bash
  git clone https://github.com/Tibic4/Agencia-Fashion.git
  cd Agencia-Fashion/campanha-ia
  npm install
  ```

- [ ] Configurar `.env.local` com todas as variáveis (ver `APIS_PLATAFORMAS.md`)

- [ ] Build de produção
  ```bash
  npm run build
  ```

- [ ] Testar localmente
  ```bash
  npm start
  # Acessar http://IP_DA_VPS:3000
  ```

## Fase 3: PM2 (Process Manager)

- [ ] Instalar PM2
  ```bash
  npm install -g pm2
  ```

- [ ] Iniciar app
  ```bash
  cd /caminho/para/Agencia-Fashion/campanha-ia
  pm2 start npm --name "crialook" -- start
  pm2 save
  pm2 startup  # seguir instruções exibidas
  ```

- [ ] Verificar
  ```bash
  pm2 status
  pm2 logs crialook
  ```

## Fase 4: Nginx (Reverse Proxy)

- [ ] Instalar Nginx
  ```bash
  sudo apt install nginx
  ```

- [ ] Criar config `/etc/nginx/sites-available/crialook`
  ```nginx
  server {
      listen 80;
      server_name crialook.com.br www.crialook.com.br;

      location / {
          proxy_pass http://127.0.0.1:3000;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_cache_bypass $http_upgrade;
          proxy_read_timeout 120s;
          proxy_send_timeout 120s;

          # Tamanho de upload (fotos de produto)
          client_max_body_size 15M;
      }
  }
  ```

- [ ] Ativar site
  ```bash
  sudo ln -s /etc/nginx/sites-available/crialook /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl reload nginx
  ```

## Fase 5: DNS

- [ ] Apontar DNS do domínio:
  ```
  A     crialook.com.br      → IP_DA_VPS
  A     www.crialook.com.br   → IP_DA_VPS
  ```

- [ ] Aguardar propagação (até 24h, geralmente minutos)

## Fase 6: SSL (HTTPS)

- [ ] Instalar Certbot
  ```bash
  sudo apt install certbot python3-certbot-nginx
  ```

- [ ] Gerar certificado
  ```bash
  sudo certbot --nginx -d crialook.com.br -d www.crialook.com.br
  ```

- [ ] Verificar renovação automática
  ```bash
  sudo certbot renew --dry-run
  ```

## Fase 7: Webhooks Externos

- [ ] **Clerk:** Configurar webhook URL → `https://crialook.com.br/api/webhooks/clerk`
- [ ] **Mercado Pago:** Configurar IPN URL → `https://crialook.com.br/api/webhooks/mercadopago`
- [ ] **Inngest:** Configurar serve URL → `https://crialook.com.br/api/inngest`

## Fase 8: Validação Final

- [ ] Landing page abre no domínio
- [ ] Login/cadastro funciona
- [ ] Geração de campanha funciona
- [ ] WhatsApp flutuante aparece
- [ ] Vitrine antes/depois carrega (se tiver itens)
- [ ] Painel admin acessível
- [ ] HTTPS ativo (cadeado verde)
- [ ] Sentry recebendo eventos
- [ ] PostHog rastreando pageviews

## Fase 9: Pós-Deploy

- [ ] Criar planos de assinatura no Mercado Pago
- [ ] Configurar pagamentos avulsos (créditos)
- [ ] Upload de fotos antes/depois na vitrine
- [ ] Primeiro teste real com produto da loja

---

## 🔧 Comandos Úteis (Manutenção)

```bash
# Atualizar código
cd /caminho/para/Agencia-Fashion
git pull
cd campanha-ia
npm install
npm run build
pm2 restart crialook

# Ver logs
pm2 logs crialook --lines 50

# Status
pm2 status

# Monitoramento
pm2 monit
```

## ⚠️ Importante

- O arquivo `.env.local` **nunca** vai pro Git (está no .gitignore)
- O `client_max_body_size 15M` no Nginx permite upload de fotos até 15MB
- O `proxy_read_timeout 120s` é necessário para o pipeline de IA (pode demorar ~30-60s)
- O PM2 reinicia o app automaticamente se cair
- O Certbot renova o SSL automaticamente
