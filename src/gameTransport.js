export function createGameTransport({ setGs, normalizeState=value=>value }) {
  return {
    commit(nextGs) {
      const normalized=normalizeState(nextGs);
      setGs(normalized);
      return normalized;
    },
    patch(updater) {
      setGs(previous=>normalizeState(updater(previous)));
    },
    clear() {
      setGs(null);
    },
  };
}
