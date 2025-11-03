const DEFAULT_WIDTHS = [480, 960, 1440];
const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);

const trimLeadingSlash = (value = '') => value.replace(/^\/+/, '');
const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const buildAbsoluteUrl = (baseUrl, relativePath) => {
  const normalizedRelative = trimLeadingSlash(relativePath);
  if (!normalizedRelative) {
    return baseUrl || '';
  }

  if (!baseUrl) {
    return `/${normalizedRelative}`;
  }

  const normalizedBase = trimTrailingSlash(baseUrl);
  return `${normalizedBase}/${normalizedRelative}`;
};

export const getOptimizedImageSources = (inputPath, widths = DEFAULT_WIDTHS) => {
  if (!inputPath) {
    return {
      src: '',
      hasOptimized: false,
    };
  }

  const publicUrl = process.env.PUBLIC_URL || '';
  const trimmedInput = inputPath.trim();

  if (!trimmedInput) {
    return {
      src: '',
      hasOptimized: false,
    };
  }

  const isAbsoluteUrl = /^https?:\/\//i.test(trimmedInput);
  if (isAbsoluteUrl) {
    return {
      src: trimmedInput,
      hasOptimized: false,
    };
  }

  let normalizedPath = trimmedInput;
  if (publicUrl && normalizedPath.startsWith(publicUrl)) {
    normalizedPath = normalizedPath.slice(publicUrl.length);
  }

  normalizedPath = trimLeadingSlash(normalizedPath);

  if (!normalizedPath.startsWith('images/')) {
    return {
      src: buildAbsoluteUrl(publicUrl, normalizedPath),
      hasOptimized: false,
    };
  }

  const relativeToImages = normalizedPath.slice('images/'.length);
  const dotIndex = relativeToImages.lastIndexOf('.');
  if (dotIndex === -1) {
    return {
      src: buildAbsoluteUrl(publicUrl, normalizedPath),
      hasOptimized: false,
    };
  }

  const extension = relativeToImages.slice(dotIndex + 1).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return {
      src: buildAbsoluteUrl(publicUrl, normalizedPath),
      hasOptimized: false,
    };
  }

  const baseName = relativeToImages.slice(0, dotIndex);
  const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension;
  const fallbackExtension = normalizedExtension === 'png' ? 'png' : 'jpg';
  const fallbackMimeType = normalizedExtension === 'png' ? 'image/png' : 'image/jpeg';

  const src = buildAbsoluteUrl(publicUrl, normalizedPath);
  const optimizedPrefix = buildAbsoluteUrl(publicUrl, `images/optimized/${baseName}`);

  const buildSrcSet = (ext) =>
    widths
      .map((width) => `${optimizedPrefix}-${width}w.${ext} ${width}w`)
      .join(', ');

  return {
    src,
    webpSrcSet: buildSrcSet('webp'),
    fallbackSrcSet: buildSrcSet(fallbackExtension),
    fallbackType: fallbackMimeType,
    hasOptimized: true,
  };
};

export const DEFAULT_IMAGE_WIDTHS = DEFAULT_WIDTHS;
