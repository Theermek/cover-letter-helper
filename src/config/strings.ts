/**
 * All user-facing copy in one place (TASK §11: interface in Russian).
 *
 * Centralised so the project can be translated later without hunting through
 * components, and so wording stays consistent between popup, editor, options
 * and stats.
 */

export const STRINGS = {
  appName: 'AI Cover Letter Assistant',

  common: {
    save: 'Сохранить',
    saved: 'Сохранено',
    cancel: 'Отмена',
    close: 'Закрыть',
    delete: 'Удалить',
    settings: 'Настройки',
    stats: 'Статистика рынка',
    loading: 'Загрузка...',
    show: 'Показать',
    hide: 'Скрыть',
    back: 'Назад',
    next: 'Далее',
    ready: 'Готово',
  },

  onboarding: {
    title: 'Начальная настройка',
    stepProvider: 'Провайдер и ключ',
    stepCv: 'Ваше CV',
    providerLabel: 'Провайдер',
    apiKeyLabel: 'API-ключ',
    modelLabel: 'Модель',
    customModel: 'Своя модель',
    customModelPlaceholder: 'например, gpt-4.1',
    refreshModels: 'Обновить список из API',
    refreshingModels: 'Запрашиваю список...',
    modelsRefreshed: (n: number) => `Загружено моделей: ${n}`,
    checkAndSave: 'Проверить и сохранить',
    checking: 'Проверяю ключ...',
    keyValid: 'Ключ работает.',
    getKey: 'Где взять ключ',
    privacyNote:
      'Ключ хранится только в вашем браузере и отправляется только в API выбранного провайдера.',
  },

  cv: {
    title: 'Ваше CV',
    description:
      'Письмо строится только на фактах из этого текста. Чем конкретнее CV, тем живее письмо.',
    placeholder: 'Вставьте текст резюме...',
    uploadPdf: 'Загрузить из PDF',
    parsingPdf: 'Читаю PDF...',
    pdfParsed: 'Текст извлечён, проверьте и при необходимости поправьте.',
    pdfError: 'Не удалось прочитать PDF. Вставьте текст вручную.',
    empty: 'Добавьте CV',
    emptyHint: 'Без CV генерация недоступна. Добавьте резюме в настройках.',
    wordCount: (n: number) => `${n} слов`,
  },

  generation: {
    vacancyLabel: 'Текст вакансии',
    vacancyPlaceholder: 'Вставьте описание вакансии...',
    languageLabel: 'Язык письма',
    lengthLabel: 'Длина',
    userPromptLabel: 'Дополнительные пожелания',
    userPromptPlaceholder:
      'Например: напиши в серьёзном стиле; упомяни, что готов к релокации',
    generate: 'Сгенерировать',
    generating: 'Генерирую письмо...',
    regenerate: 'Сгенерировать заново',
    copy: 'Скопировать',
    copied: 'Скопировано',
    copyError: 'Не удалось скопировать. Выделите текст в поле и скопируйте вручную.',
    resultLabel: 'Сопроводительное письмо',
    expand: 'Открыть в окне',
    companyRequirements: 'Компания просит:',
    onlyPhraseNote: 'Компания просит прислать только эту фразу, поэтому письма нет.',
    savedNew: 'Вакансия сохранена в базу.',
    savedUpdated: 'Эта вакансия уже была в базе, запись обновлена.',
    notSaved: 'Вакансию не удалось сохранить, но письмо готово.',
    emptyVacancy: 'Вставьте текст вакансии.',
  },

  contacts: {
    title: 'Мои контакты',
    summary: (n: number) => `Мои контакты (${n})`,
    empty: 'Контактов пока нет.',
    emptyHint: 'Добавьте их в настройках, чтобы вставлять в отклик одним нажатием.',
    section: 'Контакты',
    labelPlaceholder: 'Telegram',
    valuePlaceholder: '@username',
    add: 'Добавить контакт',
    up: 'Выше',
    down: 'Ниже',
    remove: 'Удалить контакт',
    copyValue: (label: string) => `Скопировать: ${label}`,
    hint: 'Показываются в popup под письмом. Порядок здесь задаёт порядок там.',
  },

  stats: {
    title: 'Требования рынка',
    show: 'Показать требования рынка',
    hardTitle: 'Топ-10 hard skills',
    softTitle: 'Топ-10 soft skills',
    lowSample: 'Мало данных, статистика может быть неточной.',
    empty: 'Пока нет сохранённых вакансий. Сгенерируйте первое письмо.',
    vacancyCount: (n: number) => `Вакансий в базе: ${n}`,
    occurrence: (count: number, total: number, percent: number) =>
      `${count} из ${total}, ${percent}%`,
    requiredShare: (percent: number) =>
      `обязательный в ${percent}% случаев, желательный в ${100 - percent}%`,
    contextsTitle: 'В каком виде встречается',
    vacancyListTitle: 'Сохранённые вакансии',
    noCompany: 'Компания не указана',
    noTitle: 'Должность не указана',
    confirmDelete: 'Удалить эту вакансию из базы?',
  },

  options: {
    title: 'Настройки',
    providerSection: 'Провайдер и модель',
    cvSection: 'CV',
    dataSection: 'Данные',
    defaultsSection: 'По умолчанию',
    export: 'Экспортировать в JSON',
    import: 'Импортировать из JSON',
    importResult: (added: number, skipped: number) =>
      `Добавлено: ${added}. Пропущено дубликатов: ${skipped}.`,
    importError: 'Файл не похож на экспорт этого расширения.',
    deleteAll: 'Удалить все данные',
    confirmDeleteAll:
      'Удалить все вакансии, настройки, ключи и CV? Это действие нельзя отменить.',
    deletedAll: 'Все данные удалены.',
    exportNote: 'API-ключи в экспорт не попадают.',
    privacyTitle: 'Приватность',
    privacyBody:
      'Все данные хранятся локально в вашем браузере. Расширение не использует собственный сервер: текст вакансии и CV отправляются только в API выбранного вами провайдера.',
  },
} as const;
