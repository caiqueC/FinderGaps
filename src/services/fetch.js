export const fetchFn = async () => {
    if (typeof fetch !== 'undefined') return fetch;
    const mod = await import('node-fetch');
    return mod.default;
};
