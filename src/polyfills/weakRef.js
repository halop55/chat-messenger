const getGlobalScope = () => {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof global !== "undefined") return global;
  if (typeof self !== "undefined") return self;
  if (typeof window !== "undefined") return window;
  return {};
};

const globalScope = getGlobalScope();

if (typeof globalScope.WeakRef === "undefined") {
  class WeakRefPolyfill {
    constructor(target) {
      if (
        target === null ||
        (typeof target !== "object" && typeof target !== "function")
      ) {
        throw new TypeError("WeakRef target must be an object");
      }

      this._target = target;
    }

    deref() {
      return this._target;
    }
  }

  Object.defineProperty(globalScope, "WeakRef", {
    configurable: true,
    writable: true,
    value: WeakRefPolyfill,
  });
}

if (typeof globalScope.FinalizationRegistry === "undefined") {
  class FinalizationRegistryPolyfill {
    constructor(cleanupCallback) {
      if (typeof cleanupCallback !== "function") {
        throw new TypeError("FinalizationRegistry cleanup must be a function");
      }

      this._cleanupCallback = cleanupCallback;
    }

    register() {}

    unregister() {
      return false;
    }
  }

  Object.defineProperty(globalScope, "FinalizationRegistry", {
    configurable: true,
    writable: true,
    value: FinalizationRegistryPolyfill,
  });
}
