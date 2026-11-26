interface Window {
  /** Test hook. Exists only when the URL has `?test=1`. */
  __game?: { state: () => string };
}
