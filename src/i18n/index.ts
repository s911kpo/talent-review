import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './zh-TW.json';
import en from './en.json';
import managerZh from './manager.zh-TW.json';
import managerEn from './manager.en.json';
import hrZh from './hr.zh-TW.json';
import hrEn from './hr.en.json';
import dashZh from './dash.zh-TW.json';
import dashEn from './dash.en.json';
import { readLocal } from '../lib/localPrefs';

export type Locale = 'zh-TW' | 'en';

void i18n.use(initReactI18next).init({
  resources: {
    'zh-TW': { translation: { ...zhTW, ...managerZh, ...hrZh, ...dashZh } },
    en: { translation: { ...en, ...managerEn, ...hrEn, ...dashEn } },
  },
  lng: readLocal('locale') === 'en' ? 'en' : 'zh-TW',
  fallbackLng: 'zh-TW',
  interpolation: { escapeValue: false },
});

export default i18n;
