const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/**
 * Prefix a /public asset with the deployment base path.
 *
 * next/image does not apply basePath under output:'export' + unoptimized, so
 * plain <img> srcs must be prefixed by hand or they 404 on the project URL.
 */
export function asset(path: string): string {
  return `${BASE_PATH}${path}`
}
