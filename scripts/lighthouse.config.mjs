import desktop from 'lighthouse/core/config/desktop-config.js';

export const pages = { inicio: '/', detalhe: '/nfts/emerald-ape-042' };
export const targets = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 };
export function configFor(profile) {
  return {
    extends: 'lighthouse:default',
    settings: {
      ...(profile === 'desktop' ? desktop.settings : {}),
      onlyCategories: Object.keys(targets),
      locale: 'pt-BR',
    },
  };
}
