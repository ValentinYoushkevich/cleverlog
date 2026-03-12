export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {

      // ─── Корректность ────────────────────────────────────────────────────────

      // Запрещает == и !=, требует === и !==
      eqeqeq: ['error', 'always'],
      // Запрещает бросать строки и объекты через throw, только new Error() или { status, code, message }
      'no-throw-literal': 'error',
      // Запрещает async функции без await внутри
      'require-await': 'error',
      // Запрещает лишний return await — добавляет ненужный микротаск
      'no-return-await': 'error',
      // Требует чтобы все ветки функции явно возвращали значение или не возвращали ничего
      'consistent-return': 'error',
      // Запрещает пустые блоки кода, включая пустые catch
      'no-empty': ['error', { allowEmptyCatch: false }],

      // ─── Переменные ──────────────────────────────────────────────────────────

      // Запрещает объявление переменных через var
      'no-var': 'error',
      // Требует const везде где переменная не переприсваивается
      'prefer-const': 'error',
      // Предупреждает о неиспользуемых переменных, кроме тех что начинаются с _
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Запрещает переменную во вложенной области перекрывать переменную из внешней
      'no-shadow': 'error',
      // Предупреждает когда мутируешь аргументы функции напрямую
      'no-param-reassign': 'error',

      // ─── Функции ─────────────────────────────────────────────────────────────

      // Максимум 4 параметра у функции — больше принимать объектом
      'max-params': ['error', 4],
      // Максимум 40 строк в теле функции (не считая пустые строки и комментарии)
      'max-lines-per-function': ['warn', { max: 40, skipBlankLines: true, skipComments: true }],
      // Убирает фигурные скобки у стрелочных функций где они не нужны
      'arrow-body-style': ['error', 'as-needed'],
      // Запрещает вложенность коллбэков/ифов глубже 3 уровней
      'max-depth': ['error', 3],

      // ─── Файлы ───────────────────────────────────────────────────────────────

      // Максимум 250 строк в файле (не считая пустые строки и комментарии)
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],

      // ─── Процесс и вывод ─────────────────────────────────────────────────────

      // Предупреждает об использовании console.log — для логов есть Winston
      'no-console': 'warn',
      // Запрещает process.exit() — убивает весь сервер вместо graceful shutdown
      'no-process-exit': 'error',

      // ─── Стиль и форматирование ──────────────────────────────────────────────

      // Не более одной пустой строки подряд, ноль пустых строк в конце файла
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
      // Требует фигурные скобки у всех if/else/for/while даже однострочных
      curly: ['error', 'all'],
      // Запрещает лишние пробелы между токенами
      'no-multi-spaces': ['error'],
      // Отступы 2 пробела, case внутри switch тоже с отступом
      indent: ['error', 2, { SwitchCase: 1 }],
      // Максимум 200 символов в строке, игнорирует URL, строки и шаблонные литералы
      'max-len': ['error', {
        code: 200,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      }],
      // Требует пробелы внутри фигурных скобок блока
      'block-spacing': ['error', 'always'],
      // Требует пробелы внутри фигурных скобок объекта
      'object-curly-spacing': ['error', 'always'],
      // Запрещает пробел перед запятой, требует пробел после
      'comma-spacing': ['error', { before: false, after: true }],
      // Требует пробел перед открывающей фигурной скобкой блока
      'space-before-blocks': ['error', 'always'],
      // Запрещает пробел перед двоеточием в объекте, требует пробел после
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      // Требует пробелы вокруг операторов присваивания и арифметики
      'space-infix-ops': ['error', { int32Hint: false }],

    },
  },
]