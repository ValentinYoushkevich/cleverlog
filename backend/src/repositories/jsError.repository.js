import db from '../config/knex.js';

export const JsErrorRepository = {
  async create(data) {
    const user = data.user ?? {};
    const request = data.request ?? {};
    const response = data.response ?? {};

    const [row] = await db('js_errors')
      .insert({
        message: data.message,
        source: data.source ?? null,
        lineno: data.lineno ?? null,
        colno: data.colno ?? null,
        stack: data.stack ?? null,
        url: data.url ?? null,
        user_agent: data.userAgent ?? null,
        ip: data.ip ?? null,
        user_id: user.id ?? null,
        user_email: user.email ?? null,
        user_name: user.name ?? null,
        request_url: request.url ?? null,
        request_method: request.method ?? null,
        request_body: request.body ?? null,
        response_status: response.status ?? null,
        response_body: response.body ?? null,
      })
      .returning('*');
    return row;
  },

  async findAll({ page = 1, limit = 50, url } = {}) {
    const offset = (page - 1) * limit;

    function applyUrlFilter(q) {
      if (!url) { return q; }
      if (url.startsWith('/')) {
        // Точное совпадение по path: извлекаем path из полного URL (без origin) и сравниваем.
        // Паттерн передаём параметром, чтобы не ломаться на спецсимволах и при url='/'.
        const pattern = '^https?://[^/]+';
        return q.whereRaw(
          "COALESCE(REGEXP_REPLACE(COALESCE(url, ''), ?::text, ''), '/') = ?",
          [pattern, url]
        );
      }
      return q.where('url', url);
    }

    const countQuery = applyUrlFilter(db('js_errors').clone());
    const countRow = await countQuery.count('id as total').first();
    const total = Number(countRow?.total ?? 0);

    const dataQuery = applyUrlFilter(db('js_errors').clone());
    const data = await dataQuery
      .select('*')
      .orderBy('created_at', 'desc')
      .offset(offset)
      .limit(limit);
    return { data, total };
  },
};
