import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './zh-TW.json';
import en from './en.json';
import managerZh from './manager.zh-TW.json';
import managerEn from './manager.en.json';
import { readLocal } from '../lib/localPrefs';

export type Locale = 'zh-TW' | 'en';

void i18n.use(initReactI18next).init({
  resources: {
    'zh-TW': { translation: { ...zhTW, ...managerZh } },
    en: { translation: { ...en, ...managerEn } },
  },
  lng: readLocal('locale') === 'en' ? 'en' : 'zh-TW',
  fallbackLng: 'zh-TW',
  interpolation: { escapeValue: false },
});

export default i18n;
