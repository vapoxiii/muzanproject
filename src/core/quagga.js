// QuaggaJS (lecture des codes-barres) : chargé à la première ouverture du scanner,
// depuis l'app elle-même (public/vendor) et non plus depuis un CDN.

let loading = null;

export function loadQuagga() {
  if (typeof window !== 'undefined' && window.Quagga) return Promise.resolve(window.Quagga);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = import.meta.env.BASE_URL + 'vendor/quagga.min.js';
      s.async = true;
      s.onload = () => (window.Quagga ? resolve(window.Quagga) : reject(new Error('quagga-missing')));
      s.onerror = () => { loading = null; s.remove(); reject(new Error('quagga-load-failed')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}
