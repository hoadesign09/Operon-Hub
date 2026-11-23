import { pingDatabase } from '@/config/database';
import { getVisibleModules } from '@/modules/registry';
import { fail, ok, withErrorHandler } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

const APP_NAME_FALLBACK = 'Operon Hub';
const APP_VERSION_FALLBACK = '1.0.0';

async function handleGetHealth() {
  const appName = process.env.APP_NAME || APP_NAME_FALLBACK;
  const appVersion = process.env.APP_VERSION || APP_VERSION_FALLBACK;
  const environment = process.env.NODE_ENV || 'development';
  const timestamp = new Date().toISOString();

  const dbCheck = await pingDatabase();
  const visibleModules = getVisibleModules(true).map((mod) => ({
    code: mod.code,
    name: mod.name,
    description: mod.description,
    basePath: mod.basePath,
    status: mod.status,
  }));

  if (!dbCheck.ok) {
    return fail(
      'DATABASE_UNAVAILABLE',
      'Không thể kết nối tới cơ sở dữ liệu MySQL. Vui lòng kiểm tra cấu hình và dịch vụ DB.',
      503,
      undefined,
      {
        app: appName,
        version: appVersion,
        status: 'DEGRADED',
        environment,
        timestamp,
        database: {
          status: 'DOWN',
          latencyMs: null,
        },
        modules: visibleModules,
      },
    );
  }

  return ok({
    app: appName,
    version: appVersion,
    status: 'HEALTHY',
    environment,
    timestamp,
    database: {
      status: 'UP',
      latencyMs: dbCheck.latencyMs,
    },
    modules: visibleModules,
  });
}

export const GET = withErrorHandler(handleGetHealth);
