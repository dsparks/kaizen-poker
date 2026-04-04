export function createGameTransport({ setGs }) {
  return {
    commit(nextGs) {
      setGs(nextGs);
      return nextGs;
    },
    patch(updater) {
      setGs(updater);
    },
    clear() {
      setGs(null);
    },
  };
}
