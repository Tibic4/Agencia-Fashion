/**
 * Componentes visuais Skia — momentos, backdrops, efeitos ambient.
 *
 * Tudo aqui desenha no GPU thread via @shopify/react-native-skia. Importar
 * desse barrel dispara o native module no primeiro render — usa import
 * lazy (dynamic `import()` da tela) se cold-start importa.
 *
 * Quando usar cada um:
 *   - Burst de celebração one-shot (compra, geração pronta) → Confetti
 *   - Visual de operação longa (geração de campanha)        → ParticleLoader
 *   - Backdrop de tela hero / auth                          → MeshGradient
 *   - Glow ambient em torno de elemento focal               → AuraGlow
 */
export { Confetti } from './Confetti';
export { MeshGradient } from './MeshGradient';
export { ParticleLoader } from './ParticleLoader';
export { AuraGlow } from './AuraGlow';
