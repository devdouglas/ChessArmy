(() => {
  const form = document.querySelector("form.report");
  if (!form) return;

  const btn = form.querySelector('button[type="submit"]');
  form.addEventListener("submit", () => {
    if (!(btn instanceof HTMLButtonElement)) return;
    btn.disabled = true;
    btn.textContent = "Sending…";
  });
})();
