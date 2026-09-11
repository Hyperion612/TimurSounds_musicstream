/**
 * pCloud API клиент для хранения аудиофайлов
 * Документация: https://docs.pcloud.com/
 */

const PCLOUD_API_BASE = 'https://api.pcloud.com';
const PCLOUD_FOLDER = 'TimurSounds/audio';

interface PCloudConfig {
  accessToken: string;
}

interface PCloudFile {
  id: number;
  name: string;
  size: number;
  contenttype: string;
  created: string;
  modified: string;
}

interface PCloudFolder {
  id: number;
  name: string;
  contents: Array<PCloudFile | PCloudFolder>;
}

let pcloudConfig: PCloudConfig | null = null;

export function initPCloud(accessToken: string): void {
  pcloudConfig = { accessToken };
  localStorage.setItem('pcloud_access_token', accessToken);
}

export function getPCloudConfig(): PCloudConfig | null {
  if (pcloudConfig) return pcloudConfig;
  const token = localStorage.getItem('pcloud_access_token');
  if (token) {
    pcloudConfig = { accessToken: token };
    return pcloudConfig;
  }
  return null;
}

export function clearPCloudConfig(): void {
  pcloudConfig = null;
  localStorage.removeItem('pcloud_access_token');
}

async function apiCall<T>(method: string, params: Record<string, any> = {}): Promise<T> {
  const config = getPCloudConfig();
  if (!config) throw new Error('pCloud не настроен');

  const url = new URL(`${PCLOUD_API_BASE}/${method}`);
  url.searchParams.set('access_token', config.accessToken);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`pCloud API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`pCloud error: ${data.error} (${data.result?.message || 'Unknown error'})`);
  }

  return data as T;
}

async function apiUpload<T>(method: string, formData: FormData): Promise<T> {
  const config = getPCloudConfig();
  if (!config) throw new Error('pCloud не настроен');

  const url = new URL(`${PCLOUD_API_BASE}/${method}`);
  url.searchParams.set('access_token', config.accessToken);

  const response = await fetch(url.toString(), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`pCloud API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`pCloud error: ${data.error} (${data.result?.message || 'Unknown error'})`);
  }

  return data as T;
}

/**
 * Получение или создание папки для аудио
 */
async function ensureAudioFolder(): Promise<number> {
  console.log('[pCloud] Проверка папки', PCLOUD_FOLDER);
  
  // Получаем корневую папку
  const root = await apiCall<PCloudFolder>('listfolder', { folderid: 0 });
  
  // Ищем или создаём папку TimurSounds
  let timurSoundsFolder = root.contents.find(
    (item): item is PCloudFolder => 'contents' in item && item.name === 'TimurSounds'
  );
  
  if (!timurSoundsFolder) {
    console.log('[pCloud] Создание папки /TimurSounds');
    const result = await apiCall<{ metadata: PCloudFolder }>('createfolder', {
      name: 'TimurSounds',
      folderid: 0,
    });
    timurSoundsFolder = result.metadata;
  }
  
  // Ищем или создаём папку audio
  let audioFolder = timurSoundsFolder.contents.find(
    (item): item is PCloudFolder => 'contents' in item && item.name === 'audio'
  );
  
  if (!audioFolder) {
    console.log('[pCloud] Создание папки /TimurSounds/audio');
    const result = await apiCall<{ metadata: PCloudFolder }>('createfolder', {
      name: 'audio',
      folderid: timurSoundsFolder.id,
    });
    audioFolder = result.metadata;
  }
  
  console.log('[pCloud] Папка готова:', audioFolder.id);
  return audioFolder.id;
}

/**
 * Загрузка аудиофайла в pCloud
 */
export async function uploadToPCloud(trackId: string, file: File): Promise<string> {
  console.log('[pCloud] Начало загрузки:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} МБ)`);
  
  const folderId = await ensureAudioFolder();
  
  // Удаляем старый файл с тем же именем, если есть
  try {
    const folder = await apiCall<PCloudFolder>('listfolder', { folderid: folderId });
    const existingFile = folder.contents.find(
      (item): item is PCloudFile => !('contents' in item) && item.name === trackId
    );
    
    if (existingFile) {
      console.log('[pCloud] Удаление старого файла:', existingFile.id);
      await apiCall('deletefile', { fileid: existingFile.id });
    }
  } catch (e) {
    console.warn('[pCloud] Ошибка при проверке существующего файла:', e);
  }
  
  // Загружаем новый файл
  console.log('[pCloud] Загрузка файла...');
  const formData = new FormData();
  formData.append('file', file, trackId);
  formData.append('folderid', String(folderId));
  
  const result = await apiUpload<{ metadata: PCloudFile[] }>('uploadfile', formData);
  
  if (!result.metadata || result.metadata.length === 0) {
    throw new Error('pCloud: файл не был загружен');
  }
  
  const uploadedFile = result.metadata[0];
  console.log('[pCloud] Файл загружен:', uploadedFile.id);
  
  // Получаем публичную ссылку
  console.log('[pCloud] Получение публичной ссылки...');
  const linkResult = await apiCall<{ hosts: string[]; path: string }>('getfilelink', {
    fileid: uploadedFile.id,
  });
  
  if (!linkResult.hosts || linkResult.hosts.length === 0) {
    throw new Error('pCloud: не удалось получить ссылку на файл');
  }
  
  const publicUrl = `https://${linkResult.hosts[0]}${linkResult.path}`;
  console.log('[pCloud] Публичная ссылка:', publicUrl);
  
  return publicUrl;
}

/**
 * Удаление аудиофайла из pCloud
 */
export async function deleteFromPCloud(trackId: string): Promise<void> {
  console.log('[pCloud] Удаление файла:', trackId);
  
  try {
    const folderId = await ensureAudioFolder();
    const folder = await apiCall<PCloudFolder>('listfolder', { folderid: folderId });
    
    const file = folder.contents.find(
      (item): item is PCloudFile => !('contents' in item) && item.name === trackId
    );
    
    if (file) {
      await apiCall('deletefile', { fileid: file.id });
      console.log('[pCloud] Файл удалён:', file.id);
    } else {
      console.log('[pCloud] Файл не найден:', trackId);
    }
  } catch (e) {
    console.warn('[pCloud] Ошибка при удалении файла:', e);
  }
}

/**
 * Проверка подключения к pCloud
 */
export async function testPCloudConnection(accessToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    console.log('[pCloud] Проверка подключения...');
    
    const url = new URL(`${PCLOUD_API_BASE}/userinfo`);
    url.searchParams.set('access_token', accessToken);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    const data = await response.json();
    
    if (data.error) {
      return { ok: false, error: data.result?.message || 'Неверный токен доступа' };
    }
    
    console.log('[pCloud] Подключение успешно, пользователь:', data.email);
    return { ok: true };
  } catch (e) {
    console.error('[pCloud] Ошибка подключения:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

/**
 * Получение OAuth URL для авторизации
 */
export function getPCloudOAuthUrl(clientId: string, redirectUri: string): string {
  const url = new URL('https://my.pcloud.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'token');
  return url.toString();
}

/**
 * Извлечение access_token из URL после OAuth редиректа
 */
export function extractAccessTokenFromUrl(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;
  
  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');
  
  // Очищаем URL от хэша
  if (token) {
    window.history.replaceState(null, '', window.location.pathname);
  }
  
  return token;
}
