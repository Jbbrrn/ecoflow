import { useLanguage } from '../LanguageContext';

const LanguageToggle = ({ compact = false, variant = 'light' }) => {
  const { language, setLanguage, t } = useLanguage();

  const handleChange = (lang) => {
    setLanguage(lang);
  };

  const baseClasses =
    'inline-flex items-center rounded-full px-1 py-0.5 border backdrop-blur shadow-sm';
  const sizeClasses = compact ? 'text-[11px]' : 'text-xs';

  const variantClasses =
    variant === 'sidebar'
      ? 'border-white/30 bg-white/10 text-white'
      : 'border-emerald-200 bg-white/80 text-emerald-800';

  const activeClasses =
    variant === 'sidebar'
      ? 'bg-white text-emerald-700'
      : 'bg-eco-green-medium text-white';

  const inactiveClasses =
    variant === 'sidebar'
      ? 'text-white/80 hover:bg-white/20'
      : 'text-emerald-700 hover:bg-emerald-50';

  return (
    <div
      className={`${baseClasses} ${sizeClasses} ${variantClasses}`}
      role="radiogroup"
      aria-label={t('language.toggle.aria')}
    >
      <button
        type="button"
        onClick={() => handleChange('en')}
        className={`px-2 py-1 rounded-full transition-colors ${
          language === 'en' ? activeClasses : inactiveClasses
        }`}
        aria-pressed={language === 'en'}
      >
        {t('language.englishShort')}
      </button>
      <button
        type="button"
        onClick={() => handleChange('fil')}
        className={`px-2 py-1 rounded-full transition-colors ${
          language === 'fil' ? activeClasses : inactiveClasses
        }`}
        aria-pressed={language === 'fil'}
      >
        {t('language.filipinoShort')}
      </button>
    </div>
  );
};

export default LanguageToggle;

