/**
 * Legal content — single source of truth for the in-app legal screens.
 *
 * Mirrors the marketing site (crialook.com.br/{termos,privacidade,dpo,
 * subprocessadores,consentimento-biometrico}). Keep these blocks in sync
 * when the site updates — schedule a quarterly review or hook a CI check
 * that flags drift.
 */
import type { LegalBlock } from '@/components/LegalPage';

const LAST_UPDATED = '3 de maio de 2026';

// ---------- Termos de Uso ---------------------------------------------------
export const termos = {
  title: 'Termos de Uso',
  subtitle:
    'Estes termos regulam o uso do CriaLook por lojistas e usuários autorizados. Ao usar o app, você concorda com tudo abaixo.',
  lastUpdated: LAST_UPDATED,
  blocks: [
    { type: 'heading', text: '1. Sobre o CriaLook' },
    {
      type: 'paragraph',
      text: 'O CriaLook é uma plataforma de inteligência artificial para criação de campanhas visuais a partir de fotos de produtos de moda. Geramos imagens, legendas e hashtags otimizadas para Instagram e WhatsApp.',
    },
    { type: 'heading', text: '2. Cadastro e conta' },
    {
      type: 'paragraph',
      text: 'Você deve fornecer informações verdadeiras no cadastro. É responsável pela segurança da sua conta. Suspeitando de acesso não autorizado, contate-nos imediatamente.',
    },
    { type: 'heading', text: '3. Uso permitido' },
    {
      type: 'list',
      items: [
        'Usar o serviço para promover seus próprios produtos de moda.',
        'Gerar campanhas para uso em redes sociais e WhatsApp.',
        'Compartilhar links públicos de campanha gerados pela plataforma.',
      ],
    },
    { type: 'heading', text: '4. Uso proibido' },
    {
      type: 'list',
      items: [
        'Enviar fotos de pessoas sem consentimento.',
        'Gerar conteúdo enganoso, ofensivo ou que viole direitos de terceiros.',
        'Tentar fazer engenharia reversa, extrair modelos ou raspar dados.',
        'Usar a plataforma para concorrer com o CriaLook ou revender o serviço.',
      ],
    },
    { type: 'heading', text: '5. Propriedade intelectual' },
    {
      type: 'paragraph',
      text: 'As fotos que você envia continuam suas. As imagens geradas pelo CriaLook a partir dessas fotos podem ser usadas livremente para promover seus produtos. O modelo de IA, o código e a marca CriaLook são nossos.',
    },
    { type: 'heading', text: '6. Pagamento e cancelamento' },
    {
      type: 'paragraph',
      text: 'Assinaturas mensais e anuais renovam automaticamente. Você pode cancelar a qualquer momento; o acesso continua até o fim do período pago. Reembolsos seguem a política da loja onde a compra foi feita (App Store / Google Play).',
    },
    { type: 'heading', text: '7. Limitação de responsabilidade' },
    {
      type: 'paragraph',
      text: 'O CriaLook é fornecido "como está". Não nos responsabilizamos por resultados comerciais, perdas indiretas ou pelo uso que você faz do conteúdo gerado.',
    },
    { type: 'heading', text: '8. Mudanças nos termos' },
    {
      type: 'paragraph',
      text: 'Podemos atualizar estes termos. Mudanças relevantes serão comunicadas no app ou por e-mail. O uso continuado após mudanças significa aceitação.',
    },
    { type: 'heading', text: '9. Contato' },
    {
      type: 'paragraph',
      text: 'Dúvidas? Escreva para contato@crialook.com.br.',
    },
    { type: 'link', label: '✉ Falar com o suporte', href: 'mailto:contato@crialook.com.br' },
  ] as LegalBlock[],
};

// ---------- Política de Privacidade ----------------------------------------
export const privacidade = {
  title: 'Política de Privacidade',
  subtitle:
    'Como o CriaLook coleta, usa e protege seus dados — em conformidade com a LGPD (Lei 13.709/2018).',
  lastUpdated: LAST_UPDATED,
  blocks: [
    { type: 'heading', text: '1. Dados que coletamos' },
    {
      type: 'list',
      items: [
        'Conta: nome, e-mail, telefone (opcional).',
        'Loja: nome, segmento, logo, cor, redes sociais, endereço de loja.',
        'Conteúdo: fotos enviadas, modelos virtuais cadastrados, campanhas geradas.',
        'Uso: telas visitadas, ações executadas, eventos de erro (via Sentry, anonimizados).',
        'Pagamento: feito via App Store / Google Play / Mercado Pago — não armazenamos dados de cartão.',
      ],
    },
    { type: 'heading', text: '2. Como usamos' },
    {
      type: 'list',
      items: [
        'Para gerar suas campanhas (operação principal do serviço).',
        'Para melhorar o produto e diagnosticar erros.',
        'Para suporte ao cliente.',
        'Para cumprir obrigações legais.',
      ],
    },
    { type: 'heading', text: '3. Base legal' },
    {
      type: 'paragraph',
      text: 'Tratamos seus dados com base no consentimento explícito (foto de pessoa, biometria) e na execução do contrato (geração de campanhas, suporte).',
    },
    { type: 'heading', text: '4. Compartilhamento' },
    {
      type: 'paragraph',
      text: 'Compartilhamos com subprocessadores estritamente necessários (hospedagem, IA, e-mail). Lista completa na seção "Subprocessadores".',
    },
    { type: 'heading', text: '5. Seus direitos (LGPD art. 18)' },
    {
      type: 'list',
      items: [
        'Confirmar a existência de tratamento.',
        'Acessar seus dados.',
        'Corrigir dados incompletos ou desatualizados.',
        'Anonimizar, bloquear ou eliminar dados desnecessários.',
        'Portar para outro fornecedor.',
        'Revogar consentimento.',
      ],
    },
    { type: 'heading', text: '6. Retenção' },
    {
      type: 'paragraph',
      text: 'Mantemos seus dados enquanto a conta estiver ativa. Após exclusão, removemos em até 30 dias, salvo obrigações legais (ex: nota fiscal).',
    },
    { type: 'heading', text: '7. Segurança' },
    {
      type: 'paragraph',
      text: 'Criptografia em trânsito (TLS 1.3) e em repouso (AES-256). Tokens guardados em Keychain (iOS) / Keystore (Android). Acessos auditados.',
    },
    { type: 'heading', text: '8. Encarregado (DPO)' },
    {
      type: 'paragraph',
      text: 'Para exercer direitos ou tirar dúvidas sobre privacidade, contate o Encarregado pelos canais da seção "Encarregado (DPO)" ou pelo e-mail abaixo.',
    },
    { type: 'link', label: '✉ contato@crialook.com.br', href: 'mailto:contato@crialook.com.br' },
  ] as LegalBlock[],
};

// ---------- Encarregado (DPO) ----------------------------------------------
export const dpo = {
  title: 'Encarregado de Dados (DPO)',
  subtitle:
    'Canal oficial para exercer seus direitos sob a LGPD.',
  lastUpdated: LAST_UPDATED,
  blocks: [
    { type: 'heading', text: 'Quem é o Encarregado' },
    {
      type: 'paragraph',
      text: 'O Encarregado é a pessoa designada pelo CriaLook para receber comunicações dos titulares de dados, da Autoridade Nacional de Proteção de Dados (ANPD) e orientar sobre práticas de proteção de dados.',
    },
    { type: 'heading', text: 'Competências (LGPD art. 41, §2º)' },
    {
      type: 'list',
      items: [
        'Receber reclamações e adotar providências.',
        'Receber comunicações da ANPD.',
        'Orientar colaboradores sobre proteção de dados.',
        'Executar atribuições do Controlador.',
      ],
    },
    { type: 'heading', text: 'Como exercer seus direitos' },
    {
      type: 'paragraph',
      text: 'Você pode solicitar: confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e revogação de consentimento. O prazo de resposta é de até 15 dias (art. 19, §3º LGPD).',
    },
    { type: 'heading', text: 'Canais de contato' },
    { type: 'link', label: '✉ contato@crialook.com.br', href: 'mailto:contato@crialook.com.br' },
    { type: 'paragraph', text: 'Inclua "DPO" no assunto para acelerar o atendimento.' },
    { type: 'heading', text: 'Reclamação à ANPD' },
    {
      type: 'paragraph',
      text: 'Se entender que sua solicitação não foi atendida adequadamente, pode peticionar à ANPD pelo canal oficial:',
    },
    { type: 'link', label: 'gov.br/anpd', href: 'https://www.gov.br/anpd' },
  ] as LegalBlock[],
};

// ---------- Subprocessadores -----------------------------------------------
export const subprocessadores = {
  title: 'Subprocessadores',
  subtitle:
    'Fornecedores que tratam dados dos usuários do CriaLook em nosso nome. Atualizamos esta lista com 15 dias de antecedência.',
  lastUpdated: LAST_UPDATED,
  blocks: [
    { type: 'heading', text: 'Clerk' },
    { type: 'kicker', text: 'EUA · Autenticação' },
    { type: 'paragraph', text: 'Gerencia login, sessões e tokens. Dados: e-mail, nome, identificadores.' },
    { type: 'link', label: 'Política de privacidade', href: 'https://clerk.com/legal/privacy' },

    { type: 'heading', text: 'Supabase' },
    { type: 'kicker', text: 'EUA · Banco de dados' },
    { type: 'paragraph', text: 'Armazenamento de loja, modelos, campanhas, histórico. Dados: tudo do produto.' },
    { type: 'link', label: 'Política de privacidade', href: 'https://supabase.com/privacy' },

    { type: 'heading', text: 'Google Cloud (Gemini)' },
    { type: 'kicker', text: 'EUA · IA' },
    { type: 'paragraph', text: 'Análise de imagem e geração de fotos com IA. Dados: fotos enviadas (deletadas após uso).' },
    { type: 'link', label: 'Política de privacidade', href: 'https://policies.google.com/privacy' },

    { type: 'heading', text: 'Anthropic (Claude)' },
    { type: 'kicker', text: 'EUA · IA' },
    { type: 'paragraph', text: 'Geração de copy (legendas, hashtags). Dados: descrição da peça.' },
    { type: 'link', label: 'Política de privacidade', href: 'https://www.anthropic.com/privacy' },

    { type: 'heading', text: 'Sentry' },
    { type: 'kicker', text: 'EUA · Observabilidade' },
    { type: 'paragraph', text: 'Monitoramento de erros (anonimizado). Dados: stack traces, breadcrumbs.' },
    { type: 'link', label: 'Política de privacidade', href: 'https://sentry.io/privacy/' },

    { type: 'heading', text: 'Mercado Pago' },
    { type: 'kicker', text: 'BRA · Pagamentos web' },
    { type: 'paragraph', text: 'Processa cobranças de cartão e Pix (apenas Android via web). Dados: nome, e-mail, CPF.' },
    { type: 'link', label: 'Política de privacidade', href: 'https://www.mercadopago.com.br/privacidade' },

    { type: 'heading', text: 'Apple / Google' },
    { type: 'kicker', text: 'EUA · IAP' },
    { type: 'paragraph', text: 'Pagamentos in-app. Dados: ID anônimo do recibo.' },

    { type: 'spacer', size: 24 },
    { type: 'heading', text: 'Como avisamos sobre mudanças' },
    {
      type: 'paragraph',
      text: 'Alterações são comunicadas com 15 dias de antecedência por e-mail e/ou aviso no app. Histórico disponível por solicitação.',
    },
  ] as LegalBlock[],
};

// ---------- Consentimento Biométrico ---------------------------------------
export const consentimentoBiometrico = {
  title: 'Consentimento Biométrico',
  subtitle:
    'Quando você envia fotos com pessoas, características biométricas (rosto, corpo) podem ser processadas pela IA. Aqui está exatamente o que acontece.',
  lastUpdated: LAST_UPDATED,
  blocks: [
    { type: 'heading', text: 'O que coletamos' },
    {
      type: 'list',
      items: [
        'Foto da peça (sem rosto): silhueta, textura, cor, caimento.',
        'Foto com rosto (opcional): apenas se você ou a pessoa fotografada consentir explicitamente.',
        'Modelo virtual cadastrado: características físicas que você define (cor de cabelo, etnia, tipo corporal).',
      ],
    },
    { type: 'heading', text: 'Como tratamos' },
    {
      type: 'list',
      items: [
        'Geração de imagem: a foto vai à IA Gemini do Google e volta como nova imagem.',
        'A foto enviada NÃO é usada para treinar o modelo de IA.',
        'A foto fica armazenada criptografada apenas pelo tempo necessário pra você ver/baixar a campanha gerada.',
        'Após 30 dias sem acesso, a foto é eliminada automaticamente.',
      ],
    },
    { type: 'heading', text: 'O que você precisa garantir' },
    {
      type: 'list',
      items: [
        'Você tem permissão por escrito da pessoa fotografada.',
        'A pessoa entende que a imagem dela será processada por IA.',
        'A pessoa pode revogar o consentimento a qualquer momento (você nos contata e removemos).',
        'Crianças e adolescentes só com consentimento dos responsáveis.',
      ],
    },
    { type: 'heading', text: 'Direitos da pessoa fotografada' },
    {
      type: 'paragraph',
      text: 'A pessoa fotografada tem todos os direitos da LGPD: acessar, corrigir, eliminar, revogar consentimento. Pode contatar diretamente o nosso Encarregado.',
    },
    { type: 'link', label: '✉ contato@crialook.com.br', href: 'mailto:contato@crialook.com.br' },
    { type: 'heading', text: 'Base legal' },
    {
      type: 'paragraph',
      text: 'Tratamos esses dados com base em consentimento explícito (LGPD art. 7º, I e art. 11, II, "a") — você marca um checkbox antes de cada upload com pessoa.',
    },
  ] as LegalBlock[],
};
