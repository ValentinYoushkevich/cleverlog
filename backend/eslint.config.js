export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
    // Запрещает == и !=, требует === и !==
      eqeqeq: ['error', 'always'],
      // Запрещает объявление переменных через var
      'no-var': 'error',
      // Требует const везде где переменная не переприсваивается
      'prefer-const': 'error',
      // Предупреждает о неиспользуемых переменных, кроме тех что начинаются с _
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
        },
      ],
      // Предупреждает об использовании console.log — для логов есть Winston
      'no-console': 'warn',
      // Запрещает process.exit() — убивает весь сервер вместо graceful shutdown
      'no-process-exit': 'error',
      // Требует чтобы все ветки функции явно возвращали значение или не возвращали ничего
      'consistent-return': 'error',
      // Запрещает бросать строки и объекты через throw, только new Error()
      'no-throw-literal': 'error',
      // Запрещает async функции без await внутри
      'require-await': 'error',
      // Запрещает лишний return await — добавляет ненужный микротаск
      'no-return-await': 'error',
      // Запрещает переменную во вложенной области перекрывать переменную из внешней
      'no-shadow': 'error',
      // Предупреждает когда мутируешь аргументы функции напрямую
      'no-param-reassign': 'error',
      // Запрещает пустые блоки кода, включая пустые catch
      'no-empty': [
        'error',
        {
          allowEmptyCatch: false,
        },
      ],
      // Не более одной пустой строки подряд, ноль пустых строк в конце файла
      'no-multiple-empty-lines': [
        'error',
        {
          max: 1,
          maxEOF: 0,
        },
      ],
      // Требует фигурные скобки у всех if/else/for/while даже однострочных
      curly: ['error', 'all'],
      // Запрещает лишние пробелы между токенами
      'no-multi-spaces': ['error'],
      // Отступы 2 пробела, case внутри switch тоже с отступом
      indent: [
        'error',
        2,
        {
          SwitchCase: 1,
        },
      ],
      // Максимум 200 символов в строке, игнорирует URL, строки и шаблонные литералы
      'max-len': [
        'error',
        {
          code: 200,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      // Требует пробелы внутри фигурных скобок блока
      'block-spacing': ['error', 'always'],
      // Требует пробелы внутри фигурных скобок объекта
      'object-curly-spacing': ['error', 'always'],
      // Запрещает пробел перед запятой, требует пробел после
      'comma-spacing': [
        'error',
        {
          before: false,
          after: true,
        },
      ],
      // Требует пробел перед открывающей фигурной скобкой блока
      'space-before-blocks': ['error', 'always'],
      // Запрещает пробел перед двоеточием в объекте, требует пробел после
      'key-spacing': [
        'error',
        {
          beforeColon: false,
          afterColon: true,
        },
      ],
      // Требует пробелы вокруг операторов присваивания и арифметики
      'space-infix-ops': [
        'error',
        {
          int32Hint: false,
        },
      ],
      // Убирает фигурные скобки у стрелочных функций где они не нужны
      'arrow-body-style': ['error', 'as-needed'],
    },
  },
]