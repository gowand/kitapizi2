function toggleTheme(){
  document.body.classList.toggle('light');
  localStorage.setItem('kitapizi-theme', document.body.classList.contains('light') ? 'light' : 'dark');
}
if(localStorage.getItem('kitapizi-theme') === 'light'){
  document.body.classList.add('light');
}
document.querySelectorAll('.countdown').forEach(el => {
  const start = new Date(el.dataset.start).getTime();
  function tick(){
    const diff = start - Date.now();
    if(diff <= 0){
      el.textContent = 'Tahlil başladı. Sayfayı yenileyin.';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.innerHTML = `<b>${d}</b> gün <b>${h}</b> saat <b>${m}</b> dakika <b>${s}</b> saniye`;
  }
  tick();
  setInterval(tick, 1000);
});